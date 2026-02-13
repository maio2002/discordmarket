const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const OwnRoleRequest = require('../models/OwnRoleRequest');
const GuildConfig = require('../models/GuildConfig');
const coinService = require('./coinService');
const xpService = require('./xpService');
const { createEmbed, COLORS } = require('../utils/embedBuilder');
const { formatCoins } = require('../utils/formatters');
const { isTeamMember } = require('../utils/permissions');
const logger = require('../utils/logger');

async function createOwnRoleRequest(interaction, roleName, roleColor) {
  const { guild, user } = interaction;
  const dbUser = await xpService.getOrCreateUser(guild.id, user.id);

  const cost = 2250 + (dbUser.ownRoleCount * 1000);

  if (dbUser.coins < cost) {
    throw new Error(`Nicht genug Coins. Benötigt: ${formatCoins(cost)}, Vorhanden: ${formatCoins(dbUser.coins)}`);
  }

  const request = await OwnRoleRequest.create({
    guildId: guild.id,
    userId: user.id,
    roleName,
    roleColor,
    cost,
  });

  const config = await GuildConfig.findOne({ guildId: guild.id });
  const channelId = config?.approvalChannelId;
  if (!channelId) {
    throw new Error('Kein Genehmigungskanal konfiguriert. Bitte `/config` nutzen.');
  }

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    throw new Error('Genehmigungskanal nicht gefunden.');
  }

  const embed = createEmbed({
    title: 'Eigene Rolle — Anfrage',
    color: COLORS.WARNING,
    fields: [
      { name: 'Nutzer', value: `<@${user.id}>`, inline: true },
      { name: 'Rollenname', value: roleName, inline: true },
      { name: 'Farbe', value: roleColor, inline: true },
      { name: 'Kosten', value: formatCoins(cost), inline: true },
      { name: 'Bisherige eigene Rollen', value: `${dbUser.ownRoleCount}`, inline: true },
    ],
    footer: `Anfrage-ID: ${request._id}`,
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`approve_role_${request._id}`)
      .setLabel('Genehmigen')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`deny_role_${request._id}`)
      .setLabel('Ablehnen')
      .setStyle(ButtonStyle.Danger)
  );

  const msg = await channel.send({ embeds: [embed], components: [row] });
  request.messageId = msg.id;
  await request.save();

  return request;
}

async function handleRoleApprovalButton(interaction) {
  const customId = interaction.customId;
  const isApprove = customId.startsWith('approve_role_');
  const requestId = customId.replace(/^(approve|deny)_role_/, '');

  if (!await isTeamMember(interaction.member)) {
    return interaction.reply({ content: 'Du hast keine Berechtigung dafür.', ephemeral: true });
  }

  const request = await OwnRoleRequest.findById(requestId);
  if (!request) {
    return interaction.reply({ content: 'Anfrage nicht gefunden.', ephemeral: true });
  }
  if (request.status !== 'pending') {
    return interaction.reply({ content: 'Diese Anfrage wurde bereits bearbeitet.', ephemeral: true });
  }

  if (isApprove) {
    try {
      await coinService.removeCoins(request.guildId, request.userId, request.cost, 'own_role', `Eigene Rolle: ${request.roleName}`);
    } catch (err) {
      return interaction.reply({ content: `Fehler: ${err.message}`, ephemeral: true });
    }

    try {
      const guild = interaction.guild;
      const role = await guild.roles.create({
        name: request.roleName,
        color: request.roleColor,
        reason: `Eigene Rolle für <@${request.userId}>`,
      });

      const member = await guild.members.fetch(request.userId);
      await member.roles.add(role);

      request.roleId = role.id;

      const user = await xpService.getOrCreateUser(request.guildId, request.userId);
      user.ownRoleCount += 1;
      await user.save();
    } catch (err) {
      logger.error('Fehler beim Erstellen der Rolle:', err);
      return interaction.reply({ content: `Fehler beim Erstellen der Rolle: ${err.message}`, ephemeral: true });
    }

    request.status = 'approved';
    request.reviewedBy = interaction.user.id;
    request.reviewedAt = new Date();
    await request.save();

    const embed = createEmbed({
      title: 'Eigene Rolle — Genehmigt ✅',
      color: COLORS.SUCCESS,
      fields: [
        { name: 'Nutzer', value: `<@${request.userId}>`, inline: true },
        { name: 'Rolle', value: request.roleName, inline: true },
        { name: 'Genehmigt von', value: `<@${interaction.user.id}>`, inline: true },
      ],
    });
    await interaction.update({ embeds: [embed], components: [] });

    try {
      const user = await interaction.client.users.fetch(request.userId);
      await user.send(`Deine eigene Rolle **${request.roleName}** wurde genehmigt! 🎉`);
    } catch {}
  } else {
    request.status = 'denied';
    request.reviewedBy = interaction.user.id;
    request.reviewedAt = new Date();
    await request.save();

    const embed = createEmbed({
      title: 'Eigene Rolle — Abgelehnt ❌',
      color: COLORS.ERROR,
      fields: [
        { name: 'Nutzer', value: `<@${request.userId}>`, inline: true },
        { name: 'Rolle', value: request.roleName, inline: true },
        { name: 'Abgelehnt von', value: `<@${interaction.user.id}>`, inline: true },
      ],
    });
    await interaction.update({ embeds: [embed], components: [] });

    try {
      const user = await interaction.client.users.fetch(request.userId);
      await user.send(`Deine Anfrage für die Rolle **${request.roleName}** wurde leider abgelehnt.`);
    } catch {}
  }
}

async function handleCoinsApprovalButton(interaction) {
  const customId = interaction.customId;
  const isApprove = customId.startsWith('approve_coins_');
  const messageId = customId.replace(/^(approve|deny)_coins_/, '');

  if (!await isTeamMember(interaction.member)) {
    return interaction.reply({ content: 'Du hast keine Berechtigung dafür.', ephemeral: true });
  }

  let pendingApprovals;
  try {
    pendingApprovals = require('../commands/admin/givecoins').pendingApprovals;
  } catch {
    return interaction.reply({ content: '❌ Fehler beim Laden der Genehmigungsdaten.', ephemeral: true });
  }

  const data = pendingApprovals.get(messageId);
  if (!data) {
    return interaction.reply({ content: '❌ Genehmigungsanfrage nicht mehr verfügbar.', ephemeral: true });
  }

  if (isApprove) {
    try {
      await coinService.addCoins(data.guildId, data.targetId, data.amount, 'admin_give', `Genehmigt: ${data.reason}`);
      pendingApprovals.delete(messageId);

      const embed = createEmbed({
        title: 'Coin-Vergabe — Genehmigt ✅',
        color: COLORS.SUCCESS,
        fields: [
          { name: 'Nutzer', value: `<@${data.targetId}>`, inline: true },
          { name: 'Betrag', value: `${data.amount} Coins`, inline: true },
          { name: 'Genehmigt von', value: `<@${interaction.user.id}>`, inline: true },
        ],
      });
      await interaction.update({ embeds: [embed], components: [] });
    } catch (err) {
      await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  } else {
    pendingApprovals.delete(messageId);

    const embed = createEmbed({
      title: 'Coin-Vergabe — Abgelehnt ❌',
      color: COLORS.ERROR,
      fields: [
        { name: 'Nutzer', value: `<@${data.targetId}>`, inline: true },
        { name: 'Betrag', value: `${data.amount} Coins`, inline: true },
        { name: 'Abgelehnt von', value: `<@${interaction.user.id}>`, inline: true },
      ],
    });
    await interaction.update({ embeds: [embed], components: [] });
  }
}

module.exports = { createOwnRoleRequest, handleRoleApprovalButton, handleCoinsApprovalButton };
