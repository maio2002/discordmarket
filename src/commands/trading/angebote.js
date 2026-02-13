const { SlashCommandBuilder } = require('discord.js');
const tradeService = require('../../services/tradeService');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');
const { formatCoins } = require('../../utils/formatters');
const { createPaginationRow } = require('../../utils/pagination');

const STATUS_LABELS = {
  active: '🟢 Aktiv',
  pending_approval: '🟡 Ausstehend',
  completed: '✅ Abgeschlossen',
  denied: '❌ Abgelehnt',
  cancelled: '⚪ Abgebrochen',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('angebote')
    .setDescription('Zeigt alle Handelsangebote an')
    .addStringOption(opt =>
      opt
        .setName('filter')
        .setDescription('Nach Status filtern')
        .addChoices(
          { name: 'Alle', value: 'alle' },
          { name: 'Aktiv', value: 'active' },
          { name: 'Abgeschlossen', value: 'completed' },
          { name: 'Abgebrochen', value: 'cancelled' },
          { name: 'Abgelehnt', value: 'denied' }
        )
    )
    .addIntegerOption(opt =>
      opt.setName('seite').setDescription('Seite').setMinValue(1)
    ),
  async execute(interaction) {
    const filter = interaction.options.getString('filter') || 'alle';
    const page = interaction.options.getInteger('seite') || 1;
    const statusFilter = filter === 'alle' ? null : filter;

    const { offers, total, totalPages } = await tradeService.getOffers(
      interaction.guild.id,
      page,
      5,
      statusFilter
    );

    if (offers.length === 0) {
      return interaction.reply({ content: 'Keine Angebote gefunden.', ephemeral: true });
    }

    const lines = offers.map(o => {
      const typeLabel = o.type === 'role' ? '🏷️' : '🔧';
      const idShort = o._id.toString().slice(-6);
      const status = STATUS_LABELS[o.status] || o.status;
      let line = `${typeLabel} **#${idShort}** — ${o.description}\n${status} | **${formatCoins(o.price)}** | Von: <@${o.sellerId}>`;
      if (o.buyerId) {
        line += ` | Käufer: <@${o.buyerId}>`;
      }
      return line;
    });

    const filterLabel = filter === 'alle' ? 'Alle' : STATUS_LABELS[filter];
    const embed = createEmbed({
      title: `📦 Marktplatz — ${filterLabel}`,
      description: lines.join('\n\n'),
      color: COLORS.TRADE,
      footer: `Seite ${page}/${totalPages} • ${total} Angebote • Nutze /handel <id> um zu handeln`,
    });

    const components = totalPages > 1 ? [createPaginationRow(page, totalPages, 'angebote')] : [];
    await interaction.reply({ embeds: [embed], components });
  },
};
