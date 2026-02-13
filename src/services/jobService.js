const Job = require('../models/Job');
const Examination = require('../models/Examination');
const SpeakerSession = require('../models/SpeakerSession');
const coinService = require('./coinService');
const { JOB_SALARIES, SPEAKER, EXAM_COIN_REWARDS } = require('../constants');
const { jobRoles } = require('../config');
const logger = require('../utils/logger');

async function assignJob(guildId, userId, type, assignedBy, guild) {
  const existing = await Job.findOne({ guildId, userId, isActive: true });
  if (existing) {
    throw new Error(`Nutzer hat bereits einen aktiven Job: ${existing.type}`);
  }

  const salary = JOB_SALARIES[type];
  if (!salary) throw new Error(`Unbekannter Job-Typ: ${type}`);

  const roleId = jobRoles[type];
  if (roleId && guild) {
    try {
      const member = await guild.members.fetch(userId);
      await member.roles.add(roleId);
    } catch (err) {
      logger.error(`Job-Rolle konnte nicht zugewiesen werden (${type}):`, err);
    }
  }

  return Job.create({ guildId, userId, type, salary, assignedBy });
}

async function removeJob(guildId, userId, guild) {
  const job = await Job.findOne({ guildId, userId, isActive: true });
  if (!job) throw new Error('Nutzer hat keinen aktiven Job.');

  const roleId = jobRoles[job.type];
  if (roleId && guild) {
    try {
      const member = await guild.members.fetch(userId);
      await member.roles.remove(roleId);
    } catch (err) {
      logger.error(`Job-Rolle konnte nicht entfernt werden (${job.type}):`, err);
    }
  }

  job.isActive = false;
  await job.save();
  return job;
}

async function getJob(guildId, userId) {
  return Job.findOne({ guildId, userId, isActive: true }).lean();
}

async function getAllActiveJobs(guildId) {
  return Job.find({ guildId, isActive: true }).lean();
}

async function distributeWeeklyPayday(guildId) {
  const jobs = await Job.find({ guildId, isActive: true });
  let distributed = 0;

  for (const job of jobs) {
    if (job.lastPayday) {
      const daysSincePayday = (Date.now() - job.lastPayday.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSincePayday < 6) continue;
    }

    try {
      await coinService.addCoins(guildId, job.userId, job.salary, 'job_salary', `Wöchentliches Gehalt: ${job.type}`);
      job.lastPayday = new Date();
      await job.save();
      distributed++;
    } catch (err) {
      logger.error(`Gehalt-Fehler für ${job.userId}:`, err);
    }
  }

  return distributed;
}

async function recordExamination(guildId, examinerId, examineeId, outcome, notes = null) {
  const baseReward = JOB_SALARIES.examiner;
  const multiplier = EXAM_COIN_REWARDS[outcome] || 0;
  const coinsAwarded = Math.floor(baseReward * multiplier * 0.5);

  if (coinsAwarded > 0) {
    await coinService.addCoins(guildId, examineeId, coinsAwarded, 'examination', `Prüfung: ${outcome}`);
  }

  return Examination.create({
    guildId,
    examinerId,
    examineeId,
    outcome,
    notes,
    coinsAwarded,
  });
}

async function startSpeakerSession(guildId, speakerId, channelId) {
  const existing = await SpeakerSession.findOne({ guildId, speakerId, isActive: true });
  if (existing) throw new Error('Du hast bereits eine aktive Speaker-Session.');

  return SpeakerSession.create({
    guildId,
    speakerId,
    channelId,
    startTime: new Date(),
  });
}

async function endSpeakerSession(guildId, speakerId, guild) {
  const session = await SpeakerSession.findOne({ guildId, speakerId, isActive: true });
  if (!session) throw new Error('Keine aktive Speaker-Session gefunden.');

  session.endTime = new Date();
  session.isActive = false;

  try {
    const channel = await guild.channels.fetch(session.channelId);
    const members = channel.members.filter(m => !m.user.bot && m.id !== speakerId);
    session.peakAudience = Math.max(session.peakAudience, members.size);
    session.avgAudience = members.size;
  } catch {}

  const audienceMultiplier = Math.max(session.avgAudience / 10, 0.1);
  const coins = Math.floor(SPEAKER.DEFAULT_PAYOUT * Math.min(audienceMultiplier, 2));
  session.coinsAwarded = coins;
  await session.save();

  if (coins > 0) {
    await coinService.addCoins(guildId, speakerId, coins, 'speaker', `Speaker-Session (${session.avgAudience} Zuhörer)`);
  }

  return session;
}

module.exports = {
  assignJob,
  removeJob,
  getJob,
  getAllActiveJobs,
  distributeWeeklyPayday,
  recordExamination,
  startSpeakerSession,
  endSpeakerSession,
};
