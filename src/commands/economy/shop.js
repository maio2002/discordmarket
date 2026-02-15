const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');
const { COINS, LEVEL } = require('../../constants');
const { formatCoins } = require('../../utils/formatters');
const xpService = require('../../services/xpService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Öffnet den Shop mit allen Kategorien'),
  async execute(interaction) {
    const rankDisplays = await xpService.getAllRankDisplays(interaction.guild.id);
    const rankList = LEVEL.RANKS.map((r, i) =>
      `${rankDisplays[i]} — ${formatCoins(r.cost)}`
    ).join('\n');

    const embed = createEmbed({
      title: 'Shop & Rang-System',
      color: COLORS.MARKET,
      fields: [
        {
          name: '🛒 Shop',
          value: 'Im Shop findest du Rollen, Dienstleistungen, Quests und Stellenangebote.',
        },
        {
          name: '💰 Kontostand',
          value: `Zeigt deinen aktuellen Rang, Coins und Fortschritt an.\nVon dort aus kannst du Coins einzahlen, senden oder dein Postfach einsehen.`,
        },
        {
          name: '💬 Coins verdienen',
          value: [
            `**Jobs** — Gehalt durch Arbeitsstellen`,
            `**Quests** — Belohnungen für abgeschlossene Aufgaben`,
            `**Handel** — Coins durch Angebote und Dienstleistungen`,
            `**Aktivität** — Coins durch Nachrichten oder Voice-Chat`,
          ].join('\n'),
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