const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const Quiz = require('../models/Quiz');
const { createEmbed, COLORS } = require('../utils/embedBuilder');

// Aktive Quiz-Sessions: key = channelId
const activeSessions = new Map();

const LABELS = ['A', 'B', 'C', 'D'];
const EMOJIS = ['🇦', '🇧', '🇨', '🇩'];
const TIMEOUT_SECONDS = 30;

async function getQuizzes(guildId) {
  return Quiz.find({ guildId }).lean();
}

async function getQuizByTitle(guildId, title) {
  return Quiz.findOne({ guildId, title }).lean();
}

// Erstellt eine Session im Status 'pending' (freigegeben, aber noch nicht gestartet)
function createPendingSession(channelId, quiz, userId, questId) {
  const session = {
    quizId:         quiz._id.toString(),
    quiz,
    userId,
    questId,
    currentIndex:   0,
    score:          0,
    answers:        [],
    status:         'pending',  // 'pending' | 'running'
    timeoutId:      null,
    intervalId:     null,
    currentMessage: null,
  };
  activeSessions.set(channelId, session);
  return session;
}

function getSession(channelId) {
  return activeSessions.get(channelId) || null;
}

function endSession(channelId) {
  const session = activeSessions.get(channelId);
  if (session) {
    if (session.timeoutId)  clearTimeout(session.timeoutId);
    if (session.intervalId) clearInterval(session.intervalId);
  }
  activeSessions.delete(channelId);
}

// Embed für eine Frage (ohne Countdown — der steht im Content)
function buildQuestionMessage(session) {
  const { quiz, currentIndex } = session;
  const q = quiz.questions[currentIndex];
  const total = quiz.questions.length;

  const embed = createEmbed({
    title: `📝 Frage ${currentIndex + 1} / ${total}`,
    description: `**${q.question}**`,
    color: COLORS.MARKET,
    footer: `Quiz: ${quiz.title}`,
  });

  const buttons = q.options.map((opt, i) =>
    new ButtonBuilder()
      .setCustomId(`quiz_answer_${currentIndex}_${i}`)
      .setLabel(`${LABELS[i]}) ${opt}`)
      .setEmoji(EMOJIS[i])
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(buttons)] };
}

// Verarbeitet eine Antwort (chosenIndex = -1 = Timeout)
function processAnswer(session, chosenIndex) {
  const q = session.quiz.questions[session.currentIndex];
  const correct = chosenIndex !== -1 && chosenIndex === q.correctIndex;

  session.answers.push({ questionIndex: session.currentIndex, chosenIndex, correct });
  if (correct) session.score++;
  session.currentIndex++;

  const done = session.currentIndex >= session.quiz.questions.length;
  return { correct, done, correctLabel: LABELS[q.correctIndex], correctText: q.options[q.correctIndex] };
}

function buildResultEmbed(session) {
  const { quiz, score, answers, userId } = session;
  const total = quiz.questions.length;
  const percent = Math.round((score / total) * 100);

  const answerLines = answers.map((a, i) => {
    const q = quiz.questions[a.questionIndex];
    const correct = q.options[q.correctIndex];
    if (a.chosenIndex === -1) {
      return `⏰ **F${i + 1}:** ${q.question}\n> Keine Antwort (Zeit abgelaufen) • Richtig: **${LABELS[q.correctIndex]}) ${correct}**`;
    }
    const chosen = q.options[a.chosenIndex];
    if (a.correct) return `✅ **F${i + 1}:** ${q.question}\n> Antwort: **${LABELS[a.chosenIndex]}) ${chosen}**`;
    return `❌ **F${i + 1}:** ${q.question}\n> Gewählt: ${LABELS[a.chosenIndex]}) ${chosen} • Richtig: **${LABELS[q.correctIndex]}) ${correct}**`;
  });

  const color = percent >= 70 ? COLORS.SUCCESS : percent >= 40 ? COLORS.WARNING : COLORS.ERROR;

  return createEmbed({
    title: `📊 Quiz-Auswertung — ${quiz.title}`,
    description: answerLines.join('\n\n'),
    color,
    fields: [
      { name: 'Teilnehmer', value: `<@${userId}>`, inline: true },
      { name: 'Ergebnis', value: `**${score} / ${total}** (${percent}%)`, inline: true },
    ],
    footer: 'Der Prüfer kann die Quest jetzt abschließen oder ablehnen.',
  });
}

async function buildQuizSelectMenu(guildId, questId, userId) {
  const quizzes = await getQuizzes(guildId);
  if (quizzes.length === 0) return null;

  const options = quizzes.map(q => ({
    label: q.title,
    description: `${q.questions.length} Frage(n)`,
    value: q._id.toString(),
  }));

  const select = new StringSelectMenuBuilder()
    .setCustomId(`quiz_select_${questId}_${userId}`)
    .setPlaceholder('Quiz auswählen...')
    .addOptions(options);

  return new ActionRowBuilder().addComponents(select);
}

module.exports = {
  getQuizzes,
  getQuizByTitle,
  createPendingSession,
  getSession,
  endSession,
  buildQuestionMessage,
  processAnswer,
  buildResultEmbed,
  buildQuizSelectMenu,
  LABELS,
  TIMEOUT_SECONDS,
};
