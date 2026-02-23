const { SlashCommandBuilder } = require('discord.js');
const marketService = require('../../services/marketService');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');
const { formatCoins } = require('../../utils/formatters');
const { createPaginationRow } = require('../../utils/pagination');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bestand')
    .setDescription('Zeigt den Rollen-Shop an')
    .addIntegerOption(opt =>
      opt.setName('seite').setDescription('Seite des Shops').setMinValue(1)
    )
    .setDefaultMemberPermissions(0),
  async execute(interaction) {
    const page = interaction.options.getInteger('seite') || 1;
    const { roles, total, totalPages } = await marketService.getShopRoles(
      interaction.guild.id,
      page,
      10
    );

    if (roles.length === 0) {
      return interaction.reply({ content: 'Der Shop ist leer.', ephemeral: true });
    }

    const lines = roles.map(r => {
      const stock = r.totalStock - r.purchased;
      const tag = r.isPrestige ? ' ⭐ Prestige' : '';
      return `**${r.name}**${tag} — ${formatCoins(r.price)} | Verfügbar: ${stock}/${r.totalStock}`;
    });

    const embed = createEmbed({
      title: '🛒 Rollen-Shop',
      description: lines.join('\n'),
      color: COLORS.MARKET,
      footer: `Seite ${page}/${totalPages} • Nutze /kaufen <name> zum Kaufen`,
    });

    const components = totalPages > 1 ? [createPaginationRow(page, totalPages, 'shop')] : [];
    const msg = await interaction.reply({ embeds: [embed], components, fetchReply: true });

    if (totalPages <= 1) return;

    const collector = msg.createMessageComponentCollector({ time: 120_000 });
    collector.on('collect', async (btn) => {
      if (btn.user.id !== interaction.user.id) {
        return btn.reply({ content: 'Das ist nicht dein Shop.', ephemeral: true });
      }
      const newPage = parseInt(btn.customId.split('_')[2]);
      if (isNaN(newPage)) return btn.deferUpdate();

      const result = await marketService.getShopRoles(interaction.guild.id, newPage, 10);
      const newLines = result.roles.map(r => {
        const stock = r.totalStock - r.purchased;
        const tag = r.isPrestige ? ' ⭐ Prestige' : '';
        return `**${r.name}**${tag} — ${formatCoins(r.price)} | Verfügbar: ${stock}/${r.totalStock}`;
      });

      const newEmbed = createEmbed({
        title: '🛒 Rollen-Shop',
        description: newLines.join('\n'),
        color: COLORS.MARKET,
        footer: `Seite ${newPage}/${result.totalPages} • Nutze /kaufen <name> zum Kaufen`,
      });

      await btn.update({
        embeds: [newEmbed],
        components: [createPaginationRow(newPage, result.totalPages, 'shop')],
      });
    });

    collector.on('end', () => {
      msg.edit({ components: [] }).catch(() => {});
    });
  },
};
