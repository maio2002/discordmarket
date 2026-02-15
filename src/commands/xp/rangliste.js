const { SlashCommandBuilder } = require('discord.js');
const xpService = require('../../services/xpService');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');
const { formatCoins } = require('../../utils/formatters');
const { createPaginationRow } = require('../../utils/pagination');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rangliste')
    .setDescription('Zeigt die Server-Rangliste an')
    .addIntegerOption(opt =>
      opt.setName('seite').setDescription('Seite der Rangliste').setMinValue(1)
    ),
  async execute(interaction) {
    const page = interaction.options.getInteger('seite') || 1;
    const { users, total, totalPages } = await xpService.getLeaderboard(
      interaction.guild.id,
      page,
      10
    );

    if (users.length === 0) {
      return interaction.reply({ content: 'Noch keine Nutzer in der Rangliste.', ephemeral: true });
    }

    const medals = ['🥇', '🥈', '🥉'];
    const startIndex = (page - 1) * 10;

    const lines = await Promise.all(
      users.map(async (u, i) => {
        const pos = startIndex + i + 1;
        const prefix = medals[pos - 1] || `**${pos}.**`;
        const member = await interaction.guild.members.fetch(u.userId).catch(() => null);
        const name = member?.displayName || `<@${u.userId}>`;
        const rankName = xpService.getRankName(u.level);
        return `${prefix} ${name} — ${u.level > 0 ? rankName : 'Kein Rang'} | ${formatCoins(u.coins)}`;
      })
    );

    const embed = createEmbed({
      title: `Rangliste — ${interaction.guild.name}`,
      description: lines.join('\n'),
      color: COLORS.XP,
      footer: `Seite ${page}/${totalPages} • ${total} Nutzer gesamt`,
    });

    const components = totalPages > 1 ? [createPaginationRow(page, totalPages, 'rangliste')] : [];
    const msg = await interaction.reply({ embeds: [embed], components, fetchReply: true });

    if (totalPages <= 1) return;

    const collector = msg.createMessageComponentCollector({ time: 120_000 });
    collector.on('collect', async (btn) => {
      if (btn.user.id !== interaction.user.id) {
        return btn.reply({ content: 'Das ist nicht deine Rangliste.', ephemeral: true });
      }
      const newPage = parseInt(btn.customId.split('_')[2]);
      if (isNaN(newPage)) return btn.deferUpdate();

      const result = await xpService.getLeaderboard(interaction.guild.id, newPage, 10);
      const newStart = (newPage - 1) * 10;
      const newLines = await Promise.all(
        result.users.map(async (u, i) => {
          const pos = newStart + i + 1;
          const prefix = medals[pos - 1] || `**${pos}.**`;
          const member = await interaction.guild.members.fetch(u.userId).catch(() => null);
          const name = member?.displayName || `<@${u.userId}>`;
          const rankName = xpService.getRankName(u.level);
        return `${prefix} ${name} — ${u.level > 0 ? rankName : 'Kein Rang'} | ${formatCoins(u.coins)}`;
        })
      );

      const newEmbed = createEmbed({
        title: `Rangliste — ${interaction.guild.name}`,
        description: newLines.join('\n'),
        color: COLORS.XP,
        footer: `Seite ${newPage}/${result.totalPages} • ${result.total} Nutzer gesamt`,
      });

      await btn.update({
        embeds: [newEmbed],
        components: [createPaginationRow(newPage, result.totalPages, 'rangliste')],
      });
    });

    collector.on('end', () => {
      msg.edit({ components: [] }).catch(() => {});
    });
  },
};
