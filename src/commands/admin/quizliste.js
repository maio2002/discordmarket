const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Quiz = require('../../models/Quiz');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quiz-liste')
    .setDescription('Zeigt alle Quizzes und ihre Fragen')
    .addStringOption(opt =>
      opt.setName('titel').setDescription('Nur ein bestimmtes Quiz anzeigen (optional)').setRequired(false).setAutocomplete(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const quizzes = await Quiz.find({ guildId: interaction.guild.id }).lean();
    const filtered = quizzes
      .filter(q => q.title.toLowerCase().includes(focused))
      .slice(0, 25)
      .map(q => ({ name: `${q.title} (${q.questions.length} Fragen)`, value: q.title }));
    await interaction.respond(filtered);
  },

  async execute(interaction) {
    const titel = interaction.options.getString('titel');

    const filter = { guildId: interaction.guild.id };
    if (titel) filter.title = titel;

    const quizzes = await Quiz.find(filter).lean();

    if (quizzes.length === 0) {
      return interaction.reply({ content: '❌ Keine Quizzes gefunden.', ephemeral: true });
    }

    // Ein spezifisches Quiz: Fragen detailliert anzeigen
    if (titel && quizzes.length === 1) {
      const quiz = quizzes[0];
      const LABELS = ['A', 'B', 'C'];

      if (quiz.questions.length === 0) {
        return interaction.reply({
          content: `📝 **${quiz.title}** hat noch keine Fragen.\nFüge welche hinzu mit \`/quiz-frage titel:${quiz.title}\``,
          ephemeral: true,
        });
      }

      const questionLines = quiz.questions.map((q, i) => {
        const opts = q.options.map((o, j) => `${j === q.correctIndex ? '✅' : '○'} ${LABELS[j]}) ${o}`).join('  ');
        return `**${i + 1}.** ${q.question}\n> ${opts}`;
      });

      const embed = createEmbed({
        title: `📝 Quiz — ${quiz.title}`,
        description: questionLines.join('\n\n'),
        color: COLORS.MARKET,
        fields: [{ name: 'Fragen gesamt', value: `${quiz.questions.length}`, inline: true }],
      });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Übersicht aller Quizzes
    const lines = quizzes.map(q => `> **${q.title}** — ${q.questions.length} Frage(n)`);

    const embed = createEmbed({
      title: `📝 Alle Quizzes (${quizzes.length})`,
      description: lines.join('\n'),
      color: COLORS.MARKET,
      footer: 'Tipp: /quiz-liste titel:<name> für Details',
    });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
