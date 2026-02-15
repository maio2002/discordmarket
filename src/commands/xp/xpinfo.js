const { SlashCommandBuilder } = require('discord.js');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');
const { COINS, LEVEL, WEEKLY_BONUSES } = require('../../constants');
const { formatNumber, formatCoins } = require('../../utils/formatters');
const xpService = require('../../services/xpService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('xpinfo')
    .setDescription('Erklärt das Rang- und Coin-System'),
  async execute(interaction) {
    const rankDisplays = await xpService.getAllRankDisplays(interaction.guild.id);
    const rankList = LEVEL.RANKS.map((r, i) =>
      `${rankDisplays[i]} — ${formatCoins(r.cost)}`
    ).join('\n');

    const embed = createEmbed({
      title: 'Rang-System Übersicht',
      color: COLORS.XP,
      fields: [
        {
          name: '💬 Nachrichten',
          value: `**${COINS.PER_MESSAGE_MIN}-${COINS.PER_MESSAGE_MAX} Coins** pro Nachricht\nCooldown: ${COINS.MESSAGE_COOLDOWN_MS / 1000} Sekunden`,
          inline: true,
        },
        {
          name: '🔊 Voice-Chat',
          value: `**${COINS.PER_VOICE_MIN}-${COINS.PER_VOICE_MAX} Coins** pro Minute\nMind. ${COINS.VOICE_MIN_USERS + 1} Nutzer im Channel\nDarf nicht gemutet sein`,
          inline: true,
        },
        {
          name: '⬆️ Ränge',
          value: rankList,
          inline: false,
        },
        {
          name: '🎁 Wöchentliche Boni',
          value: `Member-Rolle: **${formatNumber(WEEKLY_BONUSES.MEMBER)} Coins/Woche**\nVIP-Rolle: **${formatNumber(WEEKLY_BONUSES.VIP)} Coins/Woche**`,
          inline: false,
        },
        {
          name: '💰 Coins',
          value: 'Coins werden durch Nachrichten und Voice-Chat verdient.\nMit Coins kannst du im Shop einkaufen oder aufsteigen.',
          inline: false,
        },
      ],
      footer: 'MaioBot Rang-System',
    });

    await interaction.reply({ embeds: [embed] });
  },
};