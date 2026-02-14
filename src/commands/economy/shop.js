const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Öffnet den Shop mit allen Kategorien'),
  async execute(interaction) {
    const embed = createEmbed({
      title: '🛒 Shop',
      description: 'Klicke auf den Button, um den Shop zu öffnen!',
      color: COLORS.MARKET,
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
      new ButtonBuilder()
        .setCustomId('shop_send')
        .setLabel('Senden')
        .setEmoji('📤')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('shop_offers')
        .setLabel('Angebote')
        .setEmoji('📬')
        .setStyle(ButtonStyle.Secondary),
    );
    await interaction.reply({ embeds: [embed], components: [row] });
  },
};