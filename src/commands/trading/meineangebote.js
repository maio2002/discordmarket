const { SlashCommandBuilder } = require('discord.js');
const tradeService = require('../../services/tradeService');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');
const { formatCoins } = require('../../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('meineangebote')
    .setDescription('Zeigt deine aktiven Angebote')
    .setDefaultMemberPermissions(0),
  async execute(interaction) {
    const offers = await tradeService.getUserOffers(
      interaction.guild.id,
      interaction.user.id
    );

    if (offers.length === 0) {
      return interaction.reply({ content: 'Du hast keine aktiven Angebote.', ephemeral: true });
    }

    const lines = offers.map(o => {
      const typeLabel = o.type === 'role' ? '🏷️' : '🔧';
      const statusLabel = o.status === 'active' ? '🟢 Aktiv' : '🟡 Ausstehend';
      return `${typeLabel} **${o.description}** — ${formatCoins(o.price)}\n${statusLabel} | ID: \`${o._id}\``;
    });

    const embed = createEmbed({
      title: '📋 Deine Angebote',
      description: lines.join('\n\n'),
      color: COLORS.TRADE,
      footer: `${offers.length} Angebot(e) aktiv`,
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
