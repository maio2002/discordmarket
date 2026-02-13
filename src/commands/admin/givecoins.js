const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const GuildConfig = require('../../models/GuildConfig');
const coinService = require('../../services/coinService');
const { isAdmin } = require('../../utils/permissions');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');
const { formatCoins } = require('../../utils/formatters');

const pendingApprovals = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('givecoins')
    .setDescription('Vergebe Coins an einen Nutzer (benötigt Admin-Genehmigung)')
    .addUserOption(opt =>
      opt.setName('nutzer').setDescription('Zielnutzer').setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('betrag').setDescription('Anzahl Coins').setRequired(true).setMinValue(1)
    )
    .addStringOption(opt =>
      opt.setName('grund').setDescription('Grund für die Vergabe')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    const target = interaction.options.getUser('nutzer');
    const amount = interaction.options.getInteger('betrag');
    const reason = interaction.options.getString('grund') || 'Keine Angabe';

    const config = await GuildConfig.findOne({ guildId: interaction.guild.id });
    const approvalChannelId = config?.approvalChannelId;

    if (isAdmin(interaction.member)) {
      await coinService.addCoins(interaction.guild.id, target.id, amount, 'admin_give', `Admin: ${reason}`);
      const embed = createEmbed({
        title: 'Coins vergeben ✅',
        color: COLORS.SUCCESS,
        fields: [
          { name: 'Nutzer', value: `<@${target.id}>`, inline: true },
          { name: 'Betrag', value: formatCoins(amount), inline: true },
          { name: 'Grund', value: reason, inline: false },
          { name: 'Vergeben von', value: `<@${interaction.user.id}>`, inline: true },
        ],
      });
      return interaction.reply({ embeds: [embed] });
    }

    if (!approvalChannelId) {
      return interaction.reply({
        content: '❌ Kein Genehmigungskanal konfiguriert. Bitte `/config` nutzen.',
        ephemeral: true,
      });
    }

    const channel = await interaction.guild.channels.fetch(approvalChannelId).catch(() => null);
    if (!channel) {
      return interaction.reply({ content: '❌ Genehmigungskanal nicht gefunden.', ephemeral: true });
    }

    const embed = createEmbed({
      title: 'Coin-Vergabe — Genehmigung erforderlich',
      color: COLORS.WARNING,
      fields: [
        { name: 'Ziel', value: `<@${target.id}>`, inline: true },
        { name: 'Betrag', value: formatCoins(amount), inline: true },
        { name: 'Grund', value: reason, inline: false },
        { name: 'Angefragt von', value: `<@${interaction.user.id}>`, inline: true },
      ],
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`approve_coins_pending`)
        .setLabel('Genehmigen')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`deny_coins_pending`)
        .setLabel('Ablehnen')
        .setStyle(ButtonStyle.Danger)
    );

    const msg = await channel.send({ embeds: [embed], components: [row] });

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`approve_coins_${msg.id}`)
        .setLabel('Genehmigen')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`deny_coins_${msg.id}`)
        .setLabel('Ablehnen')
        .setStyle(ButtonStyle.Danger)
    );
    await msg.edit({ components: [row2] });

    pendingApprovals.set(msg.id, {
      guildId: interaction.guild.id,
      targetId: target.id,
      amount,
      reason,
      requesterId: interaction.user.id,
    });

    await interaction.reply({
      content: `Genehmigungsanfrage wurde gesendet. Ein Admin muss die Vergabe von **${formatCoins(amount)}** an <@${target.id}> genehmigen.`,
      ephemeral: true,
    });
  },
};

module.exports.pendingApprovals = pendingApprovals;
