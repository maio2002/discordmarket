const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');
const { COINS, LEVEL, WEEKLY_BONUSES } = require('../../constants');
const { formatCoins } = require('../../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Öffnet den Shop mit allen Kategorien'),
  async execute(interaction) {
    const rankList = LEVEL.RANKS.map((r, i) =>
      `**${i + 1}.** ${r.name} — ${formatCoins(r.cost)}`
    ).join('\n');

    const embed = createEmbed({
      title: '🛒 Shop & Rang-System',
      color: COLORS.MARKET,
      fields: [
        {
          name: '🛒 Shop',
          value: 'Im Shop findest du Rollen, Dienstleistungen, Quests und Stellenangebote.',
        },
        {
          name: '💰 Kontostand',
          value: `Zeigt deinen aktuellen Rang, Coins und Fortschritt an.\nVon dort aus kannst du Coins einzahlen, senden oder deine Meldungen einsehen.`,
        },
        {
          name: '💬 Coins verdienen',
          value: `**${COINS.PER_MESSAGE} Coins** pro Nachricht (${COINS.MESSAGE_COOLDOWN_MS / 1000}s Cooldown)\n**${COINS.PER_VOICE_MINUTE} Coins** pro Minute Voice-Chat`,
          inline: true,
        },
        {
          name: '🎁 Wöchentliche Boni',
          value: `Member: **${formatCoins(WEEKLY_BONUSES.MEMBER)}**/Woche\nVIP: **${formatCoins(WEEKLY_BONUSES.VIP)}**/Woche`,
          inline: true,
        },
        {
          name: '⬆️ Ränge',
          value: rankList,
        },
      ],
    });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('shop_open')
        .setLabel('Shop öffnen')
        .setEmoji('🛒')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('shop_balance')
        .setLabel('Kontostand')
        .setEmoji('💰')
        .setStyle(ButtonStyle.Success),
    );
    await interaction.reply({ embeds: [embed], components: [row] });
  },
};