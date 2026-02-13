const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const User = require('../../models/User');
const Transaction = require('../../models/Transaction');
const TradeOffer = require('../../models/TradeOffer');
const Examination = require('../../models/Examination');
const Job = require('../../models/Job');
const SpeakerSession = require('../../models/SpeakerSession');
const xpService = require('../../services/xpService');
const { createEmbed, COLORS } = require('../../utils/embedBuilder');
const { formatCoins, formatXp, formatNumber } = require('../../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('viewstatistics')
    .setDescription('Zeigt detaillierte Statistiken eines Nutzers an')
    .addUserOption(opt =>
      opt.setName('nutzer').setDescription('Zielnutzer').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    await interaction.deferReply();

    const target = interaction.options.getUser('nutzer');
    const guildId = interaction.guild.id;
    const userId = target.id;

    const user = await xpService.getOrCreateUser(guildId, userId);
    const rank = await xpService.getRank(guildId, userId);
    const member = await interaction.guild.members.fetch(userId).catch(() => null);

    const xpByType = await Transaction.aggregate([
      { $match: { guildId, userId, amount: { $gt: 0 } } },
      { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);

    const xpMap = {};
    for (const entry of xpByType) {
      xpMap[entry._id] = { total: entry.total, count: entry.count };
    }

    const messageXp = xpMap['message_xp'] || { total: 0, count: 0 };
    const voiceXp = xpMap['voice_xp'] || { total: 0, count: 0 };
    const weeklyXp = xpMap['weekly_bonus'] || { total: 0, count: 0 };
    const jobXp = xpMap['job_salary'] || { total: 0, count: 0 };
    const adminGive = xpMap['admin_give'] || { total: 0, count: 0 };
    const speakerXp = xpMap['speaker'] || { total: 0, count: 0 };
    const examXp = xpMap['examination'] || { total: 0, count: 0 };

    const spent = await Transaction.aggregate([
      { $match: { guildId, userId, amount: { $lt: 0 } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const totalSpent = spent.length > 0 ? Math.abs(spent[0].total) : 0;

    const tradesSold = await TradeOffer.countDocuments({ guildId, sellerId: userId, status: 'completed' });
    const tradesBought = await TradeOffer.countDocuments({ guildId, buyerId: userId, status: 'completed' });
    const tradesActive = await TradeOffer.countDocuments({ guildId, sellerId: userId, status: 'active' });

    const jobs = await Job.find({ guildId, userId }).sort({ assignedAt: -1 }).lean();
    const activeJob = jobs.find(j => j.isActive);
    const totalJobSalary = jobXp.total;

    const examsAsExaminee = await Examination.find({ guildId, examineeId: userId }).lean();
    const examsPassed = examsAsExaminee.filter(e => e.outcome === 'bestanden').length;
    const examsMittle = examsAsExaminee.filter(e => e.outcome === 'mittle_ding').length;
    const examsFailed = examsAsExaminee.filter(e => e.outcome === 'verkackt').length;
    const examsAsExaminer = await Examination.countDocuments({ guildId, examinerId: userId });

    const speakerSessions = await SpeakerSession.find({ guildId, speakerId: userId, isActive: false }).lean();
    const totalSpeakerCoins = speakerSessions.reduce((s, sess) => s + sess.coinsAwarded, 0);
    const avgAudience = speakerSessions.length > 0
      ? Math.round(speakerSessions.reduce((s, sess) => s + sess.avgAudience, 0) / speakerSessions.length)
      : 0;

    const createdAt = user.createdAt
      ? `<t:${Math.floor(new Date(user.createdAt).getTime() / 1000)}:R>`
      : 'Unbekannt';

    const embed = createEmbed({
      title: `Statistiken — ${member?.displayName || target.username}`,
      color: COLORS.PRIMARY,
      thumbnail: target.displayAvatarURL({ size: 128 }),
      fields: [
        {
          name: '📊 Übersicht',
          value: [
            `**Rang:** #${rank}`,
            `**Level:** ${user.level}`,
            `**XP:** ${formatXp(user.xp)}`,
            `**Coins:** ${formatCoins(user.coins)}`,
            `**Gesamt verdient:** ${formatCoins(user.totalXpEarned)}`,
            `**Gesamt ausgegeben:** ${formatCoins(totalSpent)}`,
            `**Erfasst seit:** ${createdAt}`,
          ].join('\n'),
          inline: false,
        },
        {
          name: '💬 XP-Quellen',
          value: [
            `Nachrichten: **${formatXp(messageXp.total)}** (${formatNumber(messageXp.count)}×)`,
            `Voice: **${formatXp(voiceXp.total)}** (${formatNumber(voiceXp.count)} Min.)`,
            `Wöchentlich: **${formatXp(weeklyXp.total)}** (${formatNumber(weeklyXp.count)}×)`,
            `Gehalt: **${formatCoins(jobXp.total)}** (${formatNumber(jobXp.count)}×)`,
            `Admin: **${formatCoins(adminGive.total)}** (${formatNumber(adminGive.count)}×)`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '🏷️ Status',
          value: [
            `Member: ${user.isMember ? '✅' : '❌'}`,
            `VIP: ${user.isVip ? '✅' : '❌'}`,
            `Eigene Rollen: **${user.ownRoleCount}**`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '💼 Job',
          value: activeJob
            ? [
                `**${activeJob.type.charAt(0).toUpperCase() + activeJob.type.slice(1)}**`,
                `Gehalt: ${formatCoins(activeJob.salary)}/Woche`,
                `Seit: <t:${Math.floor(new Date(activeJob.assignedAt).getTime() / 1000)}:R>`,
                `Bisherige Jobs: ${jobs.length}`,
                `Gesamt Gehalt: ${formatCoins(totalJobSalary)}`,
              ].join('\n')
            : `Kein aktiver Job\nBisherige Jobs: ${jobs.length}\nGesamt Gehalt: ${formatCoins(totalJobSalary)}`,
          inline: false,
        },
        {
          name: '📦 Handel',
          value: [
            `Verkauft: **${tradesSold}**`,
            `Gekauft: **${tradesBought}**`,
            `Aktive Angebote: **${tradesActive}**`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '📝 Prüfungen',
          value: [
            `Bestanden: **${examsPassed}**`,
            `Mittle Ding: **${examsMittle}**`,
            `Verkackt: **${examsFailed}**`,
            `Als Prüfer: **${examsAsExaminer}**`,
            `Coins erhalten: **${formatCoins(examXp.total)}**`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '🎤 Speaker',
          value: [
            `Sessions: **${speakerSessions.length}**`,
            `Ø Zuhörer: **${avgAudience}**`,
            `Verdient: **${formatCoins(totalSpeakerCoins)}**`,
          ].join('\n'),
          inline: true,
        },
      ],
      footer: `Nutzer-ID: ${userId}`,
    });

    await interaction.editReply({ embeds: [embed] });
  },
};
