const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const Quiz = require('../../models/Quiz');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quiz-frage')
    .setDescription('Füge eine Multiple-Choice-Frage zu einem Quiz hinzu')
    .addStringOption(opt =>
      opt.setName('titel').setDescription('Titel des Quiz').setRequired(true).setMaxLength(80).setAutocomplete(true)
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
    const title = interaction.options.getString('titel');

    const quiz = await Quiz.findOne({ guildId: interaction.guild.id, title });
    if (!quiz) {
      return interaction.reply({ content: `❌ Quiz **${title}** nicht gefunden. Erstelle es zuerst mit \`/quiz-erstellen\`.`, ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId(`modal_quiz_frage_${quiz._id}`)
      .setTitle(`Frage hinzufügen — ${title.slice(0, 30)}`);

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('question')
          .setLabel('Frage')
          .setPlaceholder('z.B. Was ist die Hauptstadt von Deutschland?')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(300)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('option_a')
          .setLabel('Antwort A')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('option_b')
          .setLabel('Antwort B')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('option_c')
          .setLabel('Antwort C (optional — leer lassen für nur 2)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(100)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('correct')
          .setLabel('Richtige Antwort (A / B / C)')
          .setPlaceholder('A')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(1)
      ),
    );

    return interaction.showModal(modal);
  },
};
