const { SlashCommandBuilder } = require('discord.js');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');
const { XP, WEEKLY_BONUSES } = require('../../constants');
const { formatNumber } = require('../../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('xpinfo')
    .setDescription('Erklärt das XP- und Level-System'),
  async execute(interaction) {
    const embed = createEmbed({
      title: 'XP-System Übersicht',
      color: COLORS.XP,
      fields: [
        {
          name: '💬 Nachrichten-XP',
          value: `**${XP.PER_MESSAGE} XP** pro Nachricht\nCooldown: ${XP.MESSAGE_COOLDOWN_MS / 1000} Sekunden`,
          inline: true,
        },
        {
          name: '🔊 Voice-XP',
          value: `**${XP.PER_VOICE_MINUTE} XP** pro Minute\nMind. ${XP.VOICE_MIN_USERS + 1} Nutzer im Channel\nDarf nicht gemutet sein`,
          inline: true,
        },
        {
          name: '📊 Level-Formel',
          value: `XP für Level N = ${XP.LEVEL_FORMULA_BASE} × N^${XP.LEVEL_FORMULA_EXPONENT}\nMax Level: **${XP.MAX_LEVEL}**`,
          inline: false,
        },
        {
          name: '🎁 Wöchentliche Boni',
          value: `Member-Rolle: **${formatNumber(WEEKLY_BONUSES.MEMBER)} XP/Woche**\nVIP-Rolle: **${formatNumber(WEEKLY_BONUSES.VIP)} XP/Woche**`,
          inline: false,
        },
        {
          name: '💰 Coins',
          value: 'Coins werden zusammen mit XP verdient (1:1).\nXP sinkt nie — Coins können ausgegeben werden.',
          inline: false,
        },
      ],
      footer: 'MaioBot XP-System',
    });

    await interaction.reply({ embeds: [embed] });
  },
};
