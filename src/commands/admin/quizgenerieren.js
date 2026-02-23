const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const OpenAI = require('openai');
const Quiz = require('../../models/Quiz');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');

const LABELS = ['A', 'B', 'C'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quiz-generieren')
    .setDescription('Lässt OpenAI automatisch einen Quiz erstellen')
    .addStringOption(opt =>
      opt.setName('thema')
        .setDescription('Thema des Quiz (z.B. "Discord-Regeln", "JavaScript-Grundlagen")')
        .setRequired(true)
        .setMaxLength(200)
    )
    .addIntegerOption(opt =>
      opt.setName('anzahl')
        .setDescription('Anzahl der Fragen (1–10, Standard: 5)')
        .setMinValue(1)
        .setMaxValue(10)
    )
    .addStringOption(opt =>
      opt.setName('titel')
        .setDescription('Quiz-Name (optional — Standard: Thema wird verwendet)')
        .setMaxLength(80)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const thema  = interaction.options.getString('thema');
    const anzahl = interaction.options.getInteger('anzahl') ?? 5;
    const titel  = (interaction.options.getString('titel') ?? thema).slice(0, 80);

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-...') {
      return interaction.editReply({ content: '❌ Kein OpenAI API-Key konfiguriert. Bitte `OPENAI_API_KEY` in der `.env` setzen.' });
    }

    const existing = await Quiz.findOne({ guildId: interaction.guild.id, title: titel });
    if (existing) {
      return interaction.editReply({ content: `❌ Ein Quiz mit dem Namen **${titel}** existiert bereits. Wähle einen anderen Titel mit \`/quiz-generieren ... titel:...\`.` });
    }

    await interaction.editReply({ content: `⏳ Generiere ${anzahl} Fragen zum Thema **${thema}**…` });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    let parsed;
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Du bist ein Quiz-Generator für Discord-Server. Antworte ausschließlich mit validem JSON, ohne Markdown-Codeblöcke.',
          },
          {
            role: 'user',
            content:
              `Erstelle ${anzahl} Multiple-Choice-Fragen auf Deutsch zum Thema "${thema}".\n\n` +
              `Gib ausschließlich JSON zurück:\n` +
              `{\n  "questions": [\n    {\n      "question": "Frage?",\n      "options": ["Antwort A", "Antwort B", "Antwort C"],\n      "correctIndex": 0\n    }\n  ]\n}\n\n` +
              `Regeln:\n` +
              `- 2 oder 3 Antwortmöglichkeiten pro Frage\n` +
              `- correctIndex ist 0-basiert (0=A, 1=B, 2=C)\n` +
              `- Fragen maximal 200 Zeichen, Antworten maximal 80 Zeichen\n` +
              `- Keine Duplikate, eindeutig richtige Antworten`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      parsed = JSON.parse(response.choices[0].message.content);
    } catch (err) {
      return interaction.editReply({ content: `❌ OpenAI-Fehler: ${err.message}` });
    }

    if (!Array.isArray(parsed?.questions) || parsed.questions.length === 0) {
      return interaction.editReply({ content: '❌ OpenAI hat kein gültiges Format zurückgegeben. Versuche es erneut.' });
    }

    const questions = parsed.questions
      .filter(q =>
        typeof q.question === 'string' &&
        Array.isArray(q.options) &&
        q.options.length >= 2 &&
        typeof q.correctIndex === 'number'
      )
      .map(q => ({
        question:     q.question.trim().slice(0, 300),
        options:      q.options.slice(0, 3).map(o => String(o).trim().slice(0, 100)),
        correctIndex: Math.max(0, Math.min(q.correctIndex, q.options.length - 1)),
      }));

    if (questions.length === 0) {
      return interaction.editReply({ content: '❌ Keine gültigen Fragen generiert. Versuche ein anderes Thema.' });
    }

    const quiz = await Quiz.create({
      guildId:   interaction.guild.id,
      title:     titel,
      createdBy: interaction.user.id,
      questions,
    });

    const previewLines = questions.map((q, i) => {
      const opts = q.options.map((o, j) => `${j === q.correctIndex ? '✅' : '○'} ${LABELS[j]}) ${o}`).join('  ');
      return `**${i + 1}.** ${q.question}\n> ${opts}`;
    });

    // Discord embed description limit: 4096 chars
    let description = previewLines.join('\n\n');
    if (description.length > 4000) {
      description = description.slice(0, 3990) + '\n…';
    }

    const embed = createEmbed({
      title: `🤖 Quiz generiert — ${quiz.title}`,
      color: COLORS.SUCCESS,
      description,
      fields: [
        { name: 'Fragen',  value: `${questions.length}`, inline: true },
        { name: 'Thema',   value: thema,                 inline: true },
      ],
      footer: 'Gespeichert. Entfernen mit /quiz-entfernen • Fragen ergänzen mit /quiz-frage',
    });

    return interaction.editReply({ content: '', embeds: [embed] });
  },
};
