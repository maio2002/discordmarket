const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const User = require('../../models/User');
const xpService = require('../../services/xpService');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');
const { LEVEL } = require('../../constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setxp')
    .setDescription('Setze den Rang eines Nutzers manuell')
    .addUserOption(opt =>
      opt.setName('nutzer').setDescription('Zielnutzer').setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('betrag').setDescription('Neuer Rang (0-9)').setRequired(true).setMinValue(0).setMaxValue(LEVEL.MAX_LEVEL)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const target = interaction.options.getUser('nutzer');
    const level = interaction.options.getInteger('betrag');

    const user = await xpService.getOrCreateUser(interaction.guild.id, target.id);
    user.level = level;
    user.levelProgress = 0;
    await user.save();

    const rankName = xpService.getRankName(level);

    const embed = createEmbed({
      title: 'Rang gesetzt',
      color: COLORS.XP,
      fields: [
        { name: 'Nutzer', value: `<@${target.id}>`, inline: true },
        { name: 'Neuer Rang', value: level > 0 ? `${rankName} (${level})` : 'Kein Rang (0)', inline: true },
        { name: 'Gesetzt von', value: `<@${interaction.user.id}>`, inline: true },
      ],
    });
    await interaction.reply({ embeds: [embed] });
  },
};