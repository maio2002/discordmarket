const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const User = require('../../models/User');
const xpService = require('../../services/xpService');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');
const { LEVEL } = require('../../constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setxp')
    .setDescription('Setze das Level eines Nutzers manuell')
    .addUserOption(opt =>
      opt.setName('nutzer').setDescription('Zielnutzer').setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('betrag').setDescription('Neues Level').setRequired(true).setMinValue(0).setMaxValue(LEVEL.MAX_LEVEL)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const target = interaction.options.getUser('nutzer');
    const level = interaction.options.getInteger('betrag');

    const user = await xpService.getOrCreateUser(interaction.guild.id, target.id);
    user.level = level;
    await user.save();

    const embed = createEmbed({
      title: 'Level gesetzt',
      color: COLORS.XP,
      fields: [
        { name: 'Nutzer', value: `<@${target.id}>`, inline: true },
        { name: 'Neues Level', value: `${level}`, inline: true },
        { name: 'Gesetzt von', value: `<@${interaction.user.id}>`, inline: true },
      ],
    });
    await interaction.reply({ embeds: [embed] });
  },
};