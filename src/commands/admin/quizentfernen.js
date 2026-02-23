const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Quiz = require('../../models/Quiz');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quiz-entfernen')
    .setDescription('Entfernt ein Quiz')
    .addStringOption(opt =>
      opt.setName('titel').setDescription('Titel des Quiz').setRequired(true).setMaxLength(80).setAutocomplete(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const Quiz = require('../../models/Quiz');
    const quizzes = await Quiz.find({ guildId: interaction.guild.id }).lean();
    const filtered = quizzes
      .filter(q => q.title.toLowerCase().includes(focused))
      .slice(0, 25)
      .map(q => ({ name: `${q.title} (${q.questions.length} Fragen)`, value: q.title }));
    await interaction.respond(filtered);
  },

  async execute(interaction) {
    const title = interaction.options.getString('titel');

    const quiz = await Quiz.findOneAndDelete({ guildId: interaction.guild.id, title });
    if (!quiz) {
      return interaction.reply({ content: `❌ Kein Quiz mit dem Titel **${title}** gefunden.`, ephemeral: true });
    }

    const embed = createEmbed({
      title: '🗑️ Quiz entfernt',
      color: COLORS.ERROR,
      description: `Das Quiz **${quiz.title}** (${quiz.questions.length} Fragen) wurde gelöscht.`,
    });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
