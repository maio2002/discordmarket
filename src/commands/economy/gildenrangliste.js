const { SlashCommandBuilder } = require('discord.js');
const GuildTeam = require('../../models/GuildTeam');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');
const { formatCoins } = require('../../utils/formatters');
const { GUILD } = require('../../constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gildenrangliste')
    .setDescription('Zeigt die Top-Gilden des Servers'),

  async execute(interaction) {
    const teams = await GuildTeam.find({ guildId: interaction.guild.id })
      .sort({ level: -1, treasury: -1 })
      .limit(10);

    if (!teams.length) {
      return interaction.reply({ content: '❌ Noch keine Gilden auf diesem Server.', ephemeral: true });
    }

    const medals = ['🥇', '🥈', '🥉'];
    const lines = teams.map((t, i) => {
      const prefix = medals[i] ?? `**${i + 1}.**`;
      const levelName = GUILD.LEVELS[t.level]?.name ?? '?';
      const manifest = t.description
        ? `\n*${t.description.length > 80 ? t.description.substring(0, 80) + '…' : t.description}*`
        : '';
      return `${prefix} **${t.name}** — ${levelName} | 👥 ${t.members.length} | 💰 ${formatCoins(t.treasury)}${manifest}`;
    }).join('\n\n');

    const embed = createEmbed({
      title: '⚔️ Gilden-Rangliste',
      color: COLORS.GOLD,
      description: lines,
      footer: `${teams.length} Gilde(n) auf diesem Server`,
    });

    return interaction.reply({ embeds: [embed] });
  },
};
