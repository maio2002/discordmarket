const { SlashCommandBuilder } = require('discord.js');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');
const { COINS, LEVEL, WEEKLY_BONUSES } = require('../../constants');
const { formatNumber } = require('../../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('xpinfo')
    .setDescription('Erklärt das Level- und Coin-System'),
  async execute(interaction) {
    const embed = createEmbed({
      title: 'Level-System Übersicht',
      color: COLORS.XP,
      fields: [
        {
          name: '💬 Nachrichten',
          value: `**${COINS.PER_MESSAGE} Coins** pro Nachricht\nCooldown: ${COINS.MESSAGE_COOLDOWN_MS / 1000} Sekunden`,
          inline: true,
        },
        {
          name: '🔊 Voice-Chat',
          value: `**${COINS.PER_VOICE_MINUTE} Coins** pro Minute\nMind. ${COINS.VOICE_MIN_USERS + 1} Nutzer im Channel\nDarf nicht gemutet sein`,
          inline: true,
        },
        {
          name: '⬆️ Aufleveln',
          value: `Level-Ups kosten Coins.\nKosten für Level N = ${LEVEL.FORMULA_BASE} × N^${LEVEL.FORMULA_EXPONENT}\nMax Level: **${LEVEL.MAX_LEVEL}**`,
          inline: false,
        },
        {
          name: '🎁 Wöchentliche Boni',
          value: `Member-Rolle: **${formatNumber(WEEKLY_BONUSES.MEMBER)} Coins/Woche**\nVIP-Rolle: **${formatNumber(WEEKLY_BONUSES.VIP)} Coins/Woche**`,
          inline: false,
        },
        {
          name: '💰 Coins',
          value: 'Coins werden durch Nachrichten und Voice-Chat verdient.\nMit Coins kannst du im Shop einkaufen oder aufleveln.',
          inline: false,
        },
      ],
      footer: 'MaioBot Level-System',
    });

    await interaction.reply({ embeds: [embed] });
  },
};