const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const coinService = require('../../services/coinService');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');
const { formatCoins } = require('../../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removecoins')
    .setDescription('Entferne Coins von einem Nutzer')
    .addUserOption(opt =>
      opt.setName('nutzer').setDescription('Zielnutzer').setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('betrag').setDescription('Anzahl Coins').setRequired(true).setMinValue(1)
    )
    .addStringOption(opt =>
      opt.setName('grund').setDescription('Grund')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const target = interaction.options.getUser('nutzer');
    const amount = interaction.options.getInteger('betrag');
    const reason = interaction.options.getString('grund') || 'Keine Angabe';

    try {
      await coinService.removeCoins(
        interaction.guild.id,
        target.id,
        amount,
        'admin_remove',
        `Admin-Abzug: ${reason}`
      );

      const embed = createEmbed({
        title: 'Coins entfernt ✅',
        color: COLORS.ERROR,
        fields: [
          { name: 'Nutzer', value: `<@${target.id}>`, inline: true },
          { name: 'Betrag', value: formatCoins(amount), inline: true },
          { name: 'Grund', value: reason, inline: false },
          { name: 'Entfernt von', value: `<@${interaction.user.id}>`, inline: true },
        ],
      });
      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  },
};
