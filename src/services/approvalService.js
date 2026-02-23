const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const OwnRoleRequest = require('../models/OwnRoleRequest');
const ServiceRequest = require('../models/ServiceRequest');
const Service = require('../models/Service');
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

  // Profanity blacklist
  const blacklist = [
    'nigger', 'neger', 'nigga', 'n1gger', 'n1gga',
    'hitler', 'nazi', 'heil',
    'fuck', 'scheiße', 'scheisse', 'fotze', 'hurensohn',
    'arschloch', 'wichser', 'bastard',
    'schwuchtel', 'transe',
    'spast', 'mongo', 'behinderter',
  ];

  const lowerName = roleName.toLowerCase();
  const containsBlacklisted = blacklist.some(word => lowerName.includes(word));

  if (containsBlacklisted) {
    throw new Error('Dieser Rollenname enthält unangemessene Begriffe und ist nicht erlaubt.');
  }

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

async function createServiceRequest(interaction, name, description, price) {
  const { guild, user } = interaction;

  // Prüfen ob User bereits einen Service mit diesem Namen hat
  const existingService = await Service.findOne({
    guildId: guild.id,
    providerId: user.id,
    name: name,
  });

  if (existingService) {
    throw new Error(`Du hast bereits einen Service mit dem Namen "**${name}**".`);
  }

  // Prüfen ob es bereits eine pending Anfrage mit diesem Namen gibt
  const existingRequest = await ServiceRequest.findOne({
    guildId: guild.id,
    userId: user.id,
    name: name,
    status: 'pending',
  });

  if (existingRequest) {
    throw new Error(`Du hast bereits eine laufende Anfrage für "**${name}**".`);
  }

  const request = await ServiceRequest.create({
    guildId: guild.id,
    userId: user.id,
    name,
    description,
    price,
  });

  const config = await GuildConfig.findOne({ guildId: guild.id });
  const channelId = config?.approvalChannelId;
  if (!channelId) {
    throw new Error('Kein Genehmigungskanal konfiguriert. Bitte einen Admin kontaktieren.');
  }

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    throw new Error('Genehmigungskanal nicht gefunden.');
  }

  const embed = createEmbed({
    title: '🔧 Service-Anfrage',
    color: COLORS.WARNING,
    description: `> ${description}`,
    fields: [
      { name: 'Nutzer', value: `<@${user.id}>`, inline: true },
      { name: 'Service-Name', value: name, inline: true },
      { name: 'Preis', value: formatCoins(price), inline: true },
    ],
    footer: `Anfrage-ID: ${request._id}`,
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`approve_service_${request._id}`)
      .setLabel('Genehmigen')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`deny_service_${request._id}`)
      .setLabel('Ablehnen')
      .setStyle(ButtonStyle.Danger)
  );

  const msg = await channel.send({ embeds: [embed], components: [row] });
  request.messageId = msg.id;
  request.channelId = channel.id;
  await request.save();

  return request;
}

async function handleServiceApprovalButton(interaction) {
  const customId = interaction.customId;
  const isApprove = customId.startsWith('approve_service_');
  const requestId = customId.replace(/^(approve|deny)_service_/, '');

  if (!await isTeamMember(interaction.member)) {
    return interaction.reply({ content: 'Du hast keine Berechtigung dafür.', ephemeral: true });
  }

  const request = await ServiceRequest.findById(requestId);
  if (!request) {
    return interaction.reply({ content: 'Anfrage nicht gefunden.', ephemeral: true });
  }
  if (request.status !== 'pending') {
    return interaction.reply({ content: 'Diese Anfrage wurde bereits bearbeitet.', ephemeral: true });
  }

  if (isApprove) {
    try {
      const service = await Service.create({
        guildId: request.guildId,
        name: request.name,
        description: request.description,
        price: request.price,
        providerId: request.userId,
      });

      request.serviceId = service._id.toString();
      request.status = 'approved';
      request.reviewedBy = interaction.user.id;
      request.reviewedAt = new Date();
      await request.save();

      const embed = createEmbed({
        title: '🔧 Service-Anfrage — Genehmigt ✅',
        color: COLORS.SUCCESS,
        fields: [
          { name: 'Nutzer', value: `<@${request.userId}>`, inline: true },
          { name: 'Service', value: request.name, inline: true },
          { name: 'Preis', value: formatCoins(request.price), inline: true },
          { name: 'Genehmigt von', value: `<@${interaction.user.id}>`, inline: true },
        ],
      });
      await interaction.update({ embeds: [embed], components: [] });

      try {
        const user = await interaction.client.users.fetch(request.userId);
        await user.send(`Dein Service **${request.name}** wurde genehmigt und ist jetzt im Shop verfügbar! 🎉`);
      } catch {}
    } catch (err) {
      logger.error('Fehler beim Erstellen des Services:', err);
      return interaction.reply({ content: `❌ Fehler beim Erstellen: ${err.message}`, ephemeral: true });
    }
  } else {
    request.status = 'denied';
    request.reviewedBy = interaction.user.id;
    request.reviewedAt = new Date();
    await request.save();

    const embed = createEmbed({
      title: '🔧 Service-Anfrage — Abgelehnt ❌',
      color: COLORS.ERROR,
      fields: [
        { name: 'Nutzer', value: `<@${request.userId}>`, inline: true },
        { name: 'Service', value: request.name, inline: true },
        { name: 'Abgelehnt von', value: `<@${interaction.user.id}>`, inline: true },
      ],
    });
    await interaction.update({ embeds: [embed], components: [] });

    try {
      const user = await interaction.client.users.fetch(request.userId);
      await user.send(`Deine Anfrage für den Service **${request.name}** wurde leider abgelehnt.`);
    } catch {}
  }
}

module.exports = {
  createOwnRoleRequest,
  handleRoleApprovalButton,
  handleCoinsApprovalButton,
  createServiceRequest,
  handleServiceApprovalButton,
};
