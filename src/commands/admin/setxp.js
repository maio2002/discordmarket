const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const xpService = require('../../services/xpService');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');
const { formatXp } = require('../../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setxp')
    .setDescription('Setze die XP eines Nutzers manuell')
    .addUserOption(opt =>
      opt.setName('nutzer').setDescription('Zielnutzer').setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('betrag').setDescription('Neue XP-Menge').setRequired(true).setMinValue(0)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const target = interaction.options.getUser('nutzer');
    const amount = interaction.options.getInteger('betrag');

    const user = await xpService.setXp(interaction.guild.id, target.id, amount);

    const embed = createEmbed({
      title: 'XP gesetzt ✅',
      color: COLORS.XP,
      fields: [
        { name: 'Nutzer', value: `<@${target.id}>`, inline: true },
        { name: 'Neue XP', value: formatXp(amount), inline: true },
        { name: 'Neues Level', value: `${user.level}`, inline: true },
        { name: 'Gesetzt von', value: `<@${interaction.user.id}>`, inline: true },
      ],
    });
    await interaction.reply({ embeds: [embed] });
  },
};
