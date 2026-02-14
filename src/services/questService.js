const Quest = require('../models/Quest');
const coinService = require('./coinService');
const logger = require('../utils/logger');
const { ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed, COLORS } = require('../utils/embedBuilder');
const { formatCoins } = require('../utils/formatters');
const { jobRoles } = require('../config');

async function createQuest(guildId, title, description, reward, createdBy) {
  return Quest.create({ guildId, title, description, reward, createdBy });
}

async function getOpenQuests(guildId, page = 1, perPage = 5) {
  const skip = (page - 1) * perPage;
  const filter = { guildId, status: 'open' };
  const quests = await Quest.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(perPage)
    .lean();
  const total = await Quest.countDocuments(filter);
  return { quests, total, totalPages: Math.ceil(total / perPage) || 1 };
}

async function claimQuest(guildId, questId, userId, guild) {
  const quest = await Quest.findOne({ _id: questId, guildId, status: 'open' });
  if (!quest) throw new Error('Diese Quest ist nicht mehr verfügbar.');

  const alreadyClaimed = quest.participants.some(p => p.userId === userId);
  if (alreadyClaimed) throw new Error('Du nimmst bereits an dieser Quest teil.');

  const participant = { userId };

  try {
    const permissionOverwrites = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
    ];

    if (jobRoles.examiner) {
      permissionOverwrites.push({
        id: jobRoles.examiner,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
      });
    }

    const channel = await guild.channels.create({
      name: `quest-${quest.title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20)}-${(await guild.members.fetch(userId)).displayName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20)}`,
      type: ChannelType.GuildText,
      permissionOverwrites,
    });
    participant.channelId = channel.id;

    const embed = createEmbed({
      title: `📋 Quest: ${quest.title}`,
      description: quest.description,
      color: COLORS.MARKET,
      fields: [
        { name: 'Teilnehmer', value: `<@${userId}>`, inline: true },
        { name: 'Belohnung', value: formatCoins(quest.reward), inline: true },
      ],
      footer: 'Ein Prüfer kann diese Quest abschließen oder ablehnen.',
    });

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`quest_complete_${quest._id}_${userId}`)
        .setLabel('Geschafft')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`quest_fail_${quest._id}_${userId}`)
        .setLabel('Nicht geschafft')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger),
    );

    await channel.send({ embeds: [embed], components: [buttons] });
  } catch (err) {
    logger.error(`Quest-Ticket konnte nicht erstellt werden: ${err.message}`);
  }

  quest.participants.push(participant);
  await quest.save();
  return { quest, channelId: participant.channelId };
}

async function completeQuestForUser(guildId, questId, userId, examinerId, guild) {
  const quest = await Quest.findOne({ _id: questId, guildId, status: 'open' });
  if (!quest) throw new Error('Diese Quest existiert nicht.');

  const idx = quest.participants.findIndex(p => p.userId === userId);
  if (idx === -1) throw new Error('Dieser Nutzer nimmt nicht an der Quest teil.');

  const participant = quest.participants[idx];
  const channelId = participant.channelId;

  quest.participants.splice(idx, 1);
  quest.examinerId = examinerId;
  await quest.save();

  if (quest.reward > 0) {
    await coinService.addCoins(guildId, userId, quest.reward, 'quest', `Quest abgeschlossen: ${quest.title}`);
  }

  if (channelId && guild) {
    deleteTicketChannel(guild, channelId);
  }

  return quest;
}

async function failQuestForUser(guildId, questId, userId, examinerId, guild) {
  const quest = await Quest.findOne({ _id: questId, guildId, status: 'open' });
  if (!quest) throw new Error('Diese Quest existiert nicht.');

  const idx = quest.participants.findIndex(p => p.userId === userId);
  if (idx === -1) throw new Error('Dieser Nutzer nimmt nicht an der Quest teil.');

  const participant = quest.participants[idx];
  const channelId = participant.channelId;

  quest.participants.splice(idx, 1);
  await quest.save();

  if (channelId && guild) {
    deleteTicketChannel(guild, channelId);
  }

  return quest;
}

function deleteTicketChannel(guild, channelId) {
  setTimeout(async () => {
    try {
      const ch = await guild.channels.fetch(channelId);
      if (ch) await ch.delete();
    } catch (err) {
      logger.error(`Ticket-Channel konnte nicht gelöscht werden: ${err.message}`);
    }
  }, 5000);
}

async function cancelQuest(guildId, questId) {
  const quest = await Quest.findOne({ _id: questId, guildId, status: 'open' });
  if (!quest) throw new Error('Diese Quest kann nicht abgebrochen werden.');

  quest.status = 'cancelled';
  await quest.save();
  return quest;
}

module.exports = { createQuest, getOpenQuests, claimQuest, completeQuestForUser, failQuestForUser, cancelQuest };
