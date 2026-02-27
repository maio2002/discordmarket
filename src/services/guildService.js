const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  StringSelectMenuBuilder,
  ChannelType, OverwriteType, PermissionFlagsBits,
} = require('discord.js');
const GuildTeam = require('../models/GuildTeam');
const coinService = require('./coinService');
const { createEmbed, COLORS } = require('../utils/embedBuilder');
const { formatCoins, formatNumber } = require('../utils/formatters');
const { GUILD } = require('../constants');
const logger = require('../utils/logger');
const { sendDmNotification } = require('../utils/dmNotification');
const Offer = require('../models/Offer');

// ─── Personal-Konfiguration ──────────────────────────────────────────────────

const STAFF_CONFIG = {
  supporter: {
    label:       'Supporter',
    emoji:       '🛡️',
    minLevel:    2,
    permissions: [PermissionFlagsBits.ModerateMembers],
    roleKey:     'supporterRoleId',
    description: 'Kann Mitglieder muten, jailen & timeouten',
  },
  moderator: {
    label:       'Moderator',
    emoji:       '🔨',
    minLevel:    3,
    permissions: [PermissionFlagsBits.KickMembers, PermissionFlagsBits.ManageMessages],
    roleKey:     'moderatorRoleId',
    description: 'Kann Mitglieder kicken & Nachrichten löschen',
  },
  admin: {
    label:       'Admin',
    emoji:       '👑',
    minLevel:    4,
    permissions: [PermissionFlagsBits.Administrator],
    roleKey:     'adminRoleId',
    description: 'Hat alle Rechte auf dem Server',
  },
  team: {
    label:       'Team',
    emoji:       '🤝',
    minLevel:    5,
    permissions: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageThreads],
    roleKey:     'teamRoleId',
    description: 'Gilden-Team mit erweiterten Rechten',
  },
};

const BLACKLIST = [
  'nigger', 'neger', 'nigga', 'hitler', 'nazi', 'heil',
  'fuck', 'scheiße', 'scheisse', 'fotze', 'hurensohn',
  'arschloch', 'wichser', 'schwuchtel', 'spast', 'mongo',
];

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function calcLevel(treasury) {
  const levels = GUILD.LEVELS;
  for (let i = levels.length - 1; i >= 0; i--) {
    if (treasury >= levels[i].threshold) return i;
  }
  return 0;
}

function buildProgressBar(treasury) {
  const levels = GUILD.LEVELS;
  const current = calcLevel(treasury);
  if (current >= levels.length - 1) return null;
  const next = levels[current + 1];
  const prev = levels[current];
  const filled = Math.round(((treasury - prev.threshold) / (next.threshold - prev.threshold)) * 10);
  const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
  return `${next.name} — ${bar} ${formatNumber(treasury)} / ${formatNumber(next.threshold)}`;
}

function levelColor(level) {
  const map = [COLORS.PRIMARY, COLORS.SUCCESS, COLORS.SUCCESS, COLORS.GOLD, COLORS.WARNING, COLORS.ERROR];
  return map[level] ?? COLORS.PRIMARY;
}

// ─── Embed & Payload ─────────────────────────────────────────────────────────

// ─── Detail-View (Gilden-Info + Basis-Aktionen) ───────────────────────────────

function buildGildenEmbed(team, viewerId = null) {
  const levelName = GUILD.LEVELS[team.level]?.name ?? 'Unbekannt';
  const d = new Date(team.foundedAt);
  const founded = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;

  const fields = [
    { name: 'Anführer', value: team.leaderless ? '*(Vakant)*' : `<@${team.leaderId}>`, inline: true },
    { name: 'Mitglieder', value: `${team.members.length}`, inline: true },
    { name: 'Kasse', value: formatCoins(team.treasury), inline: true },
  ];

  if (team.members.length <= 20) {
    fields.push({ name: 'Mitgliedsliste', value: team.members.map(id => `<@${id}>`).join(' ') || '—' });
  }

  const bar = buildProgressBar(team.treasury);
  if (bar) fields.push({ name: 'Nächste Stufe', value: bar });

  // Wochenbeiträge anzeigen
  const contribLines = team.members.map(id => {
    const personal = team.memberContributions?.get(id);
    const amount   = personal != null ? personal : (team.weeklyContribution ?? 0);
    const tag      = personal != null ? '' : ' *(Standard)*';
    return amount > 0 ? `• <@${id}> — ${formatCoins(amount)}/Woche${tag}` : null;
  }).filter(Boolean);
  if (contribLines.length > 0) {
    const totalContrib = team.members.reduce((sum, id) => {
      const personal = team.memberContributions?.get(id);
      return sum + (personal != null ? personal : (team.weeklyContribution ?? 0));
    }, 0);
    fields.push({
      name: `📅 Wochenbeiträge — gesamt ${formatCoins(totalContrib)}/Woche`,
      value: contribLines.join('\n'),
    });
  }

  const REWARD_LIST = [
    { level: 1, emoji: '🎨', label: 'Gilden-Rolle anpassen' },
    { level: 2, emoji: '🛡️', label: 'Supporter ernennen (Muten/Timeouten)' },
    { level: 3, emoji: '🔨', label: 'Moderator ernennen (Kicken/Nachrichten löschen)' },
    { level: 4, emoji: '👑', label: 'Admin ernennen (Alle Rechte)' },
    { level: 5, emoji: '🤝', label: 'Team aufbauen (Unbegrenzte Mitglieder)' },
  ];
  fields.push({
    name: '🏆 Stufen-Belohnungen',
    value: REWARD_LIST.map(r =>
      `${team.level >= r.level ? '✅' : '🔒'} **${r.emoji} Stufe ${r.level}** — ${r.label}`
    ).join('\n'),
  });

  const embed = createEmbed({
    title: `⚔️ ${team.name} — Stufe ${team.level} (${levelName})`,
    color: levelColor(team.level),
    description: team.description ? `*${team.description}*` : null,
    fields,
    footer: `Gegründet am ${founded}`,
  });

  // Basis-Buttons Reihe 1: für alle Mitglieder
  const isLeader = viewerId && team.leaderId === viewerId;

  const row1 = [
    new ButtonBuilder().setCustomId('gilden_donate').setLabel('Spenden').setEmoji('💰').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('gilden_news').setLabel('News').setEmoji('📰').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('gilden_aufgaben_view').setLabel('Aufgaben').setEmoji('📋').setStyle(ButtonStyle.Secondary),
  ];

  if (isLeader) {
    row1.push(new ButtonBuilder().setCustomId('gilden_manage').setLabel('Verwalten').setEmoji('🔧').setStyle(ButtonStyle.Primary));
  } else {
    row1.push(new ButtonBuilder().setCustomId('gilden_leave').setLabel('Verlassen').setEmoji('🚶').setStyle(ButtonStyle.Danger));
  }

  const components = [new ActionRowBuilder().addComponents(row1)];

  if (team.leaderless) {
    components.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('gilden_claim_leader')
        .setLabel(`Führung übernehmen (${formatCoins(GUILD.CLAIM_COST)})`)
        .setEmoji('👑')
        .setStyle(ButtonStyle.Primary),
    ));
  }

  return { embeds: [embed], components };
}

// ─── Verwaltungs-Panel (nur für Anführer) ─────────────────────────────────────

function buildManagePayload(team) {
  const pending = team.pendingRequests ?? [];

  let description = '🔧 Verwalte deine Gilde.';
  if (pending.length > 0) {
    description += `\n\n📥 **${pending.length} offene Beitrittsanfrage(n):** ${pending.map(id => `<@${id}>`).join(', ')}\n*Öffne dein Postfach unter Kontostand, um Anfragen anzunehmen oder abzulehnen.*`;
  }

  const embed = createEmbed({
    title: `🔧 ${team.name} — Verwaltung`,
    color: COLORS.PRIMARY,
    description,
  });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('gilden_invite').setLabel('Einladen').setEmoji('➕').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('gilden_kick').setLabel('Kick').setEmoji('🚪').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('gilden_manifest').setLabel('Manifest').setEmoji('📜').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('gilden_aufgaben_manage').setLabel('Aufgaben').setEmoji('📋').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('gilden_disband').setLabel('Auflösen').setEmoji('💀').setStyle(ButtonStyle.Danger),
  );

  const row2Buttons = [
    new ButtonBuilder().setCustomId('gilden_sitze').setLabel('Sitze').setEmoji('🏛️').setStyle(ButtonStyle.Secondary),
  ];
  if (team.level >= 1) {
    row2Buttons.push(
      new ButtonBuilder().setCustomId('gilden_role_color').setLabel('Rolle anpassen').setEmoji('🎨').setStyle(ButtonStyle.Secondary),
    );
  }
  if (team.level >= 2) {
    row2Buttons.push(
      new ButtonBuilder().setCustomId('gilden_personal').setLabel('Personal').setEmoji('👥').setStyle(ButtonStyle.Primary),
    );
  }

  const components = [row1, new ActionRowBuilder().addComponents(row2Buttons)];

  return { embeds: [embed], components };
}

async function buildNoGildePayload(guildId) {
  const allTeams = await GuildTeam.find({ guildId }).lean();

  const embed = createEmbed({
    title: '⚔️ Gilden-System',
    color: COLORS.PRIMARY,
    description:
      'Du bist noch keiner Gilde beigetreten.\n\n' +
      'Gilden ermöglichen dir:\n' +
      '• 💰 Gemeinsame Kasse aufbauen\n' +
      '• 🏆 Stufen-Belohnungen freischalten\n' +
      '• 🏛️ Politische Sitze im Rat gewinnen\n' +
      '• 👥 Personal mit besonderen Rechten ernennen',
  });

  const buttons = [
    new ButtonBuilder().setCustomId('gilden_rangliste').setLabel('Rangliste').setEmoji('📊').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('gilden_create').setLabel(`Gründen (${formatCoins(GUILD.FOUND_COST)})`).setEmoji('⚔️').setStyle(ButtonStyle.Success),
  ];
  if (allTeams.length) {
    buttons.push(
      new ButtonBuilder().setCustomId('gilden_join').setLabel('Beitreten').setEmoji('🤝').setStyle(ButtonStyle.Primary),
    );
  }
  buttons.push(
    new ButtonBuilder().setCustomId('gilden_sitzwahl').setLabel('Sitzwahl').setEmoji('🗳️').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(buttons)] };
}

async function getGildenPayload(guildId, userId) {
  const team = await GuildTeam.findOne({ guildId, members: userId });
  if (!team) return buildNoGildePayload(guildId);

  // Neueste News oder Platzhalter
  const sorted  = (team.news ?? []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const latest  = sorted[0];
  const levelName = GUILD.LEVELS[team.level]?.name ?? 'Unbekannt';

  let description;
  if (latest) {
    const d = new Date(latest.createdAt);
    const dateStr = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    description = `**📰 Neueste Nachricht** — *${dateStr}*\n\n${latest.content}\n\n— <@${latest.authorId}>`;
  } else {
    description = `*Noch keine Neuigkeiten in **${team.name}**.*`;
  }

  const embed = createEmbed({
    title: `⚔️ ${team.name} — Stufe ${team.level} (${levelName})`,
    color: levelColor(team.level),
    description,
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('gilden_rangliste').setLabel('Rangliste').setEmoji('📊').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('gilden_view_detail').setLabel(team.name.slice(0, 80)).setEmoji('⚔️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('gilden_sitzwahl').setLabel('Sitzwahl').setEmoji('🗳️').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row] };
}

// ─── Kanal-Verwaltung ────────────────────────────────────────────────────────

const GUILD_CHANNEL_ALLOW = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
];

function buildGuildOverwrites(discordGuild, team) {
  const base = [{ id: discordGuild.id, type: OverwriteType.Role, deny: [PermissionFlagsBits.ViewChannel] }];
  if (team.roleId) {
    return [...base, { id: team.roleId, type: OverwriteType.Role, allow: GUILD_CHANNEL_ALLOW }];
  }
  return [...base, ...team.members.map(id => ({ id, type: OverwriteType.Member, allow: GUILD_CHANNEL_ALLOW }))];
}

async function resolveMarker(discordGuild, channelId) {
  if (!channelId) return { parent: null, position: null };
  const marker = await discordGuild.channels.fetch(channelId).catch(() => null);
  if (!marker) return { parent: null, position: null };
  return { parent: marker.parentId ?? null, position: marker.position };
}

async function createGuildChannels(discordGuild, team) {
  const GuildConfig = require('../models/GuildConfig');
  const config = await GuildConfig.findOne({ guildId: discordGuild.id });

  const overwrites = buildGuildOverwrites(discordGuild, team);

  const [chatMarker, voiceMarker] = await Promise.all([
    resolveMarker(discordGuild, config?.gildenChatMarkerChannelId),
    resolveMarker(discordGuild, config?.gildenVoiceMarkerChannelId),
  ]);

  let chatId = null;
  let voiceId = null;

  // Text-Kanal — unabhängig vom Voice-Kanal
  try {
    const chatOptions = {
      name: `💬︱${team.name.toLowerCase().replace(/\s+/g, '-')}`,
      type: ChannelType.GuildText,
      permissionOverwrites: overwrites,
    };
    if (chatMarker.parent) chatOptions.parent = chatMarker.parent;
    const chat = await discordGuild.channels.create(chatOptions);
    if (chatMarker.position !== null) {
      await chat.setPosition(chatMarker.position + 1, { relative: false }).catch(() => {});
    }
    chatId = chat.id;
  } catch (err) {
    logger.warn(`Gilden-Textkanal für "${team.name}" konnte nicht erstellt werden: ${err.message}`);
  }

  // Voice-Kanal — unabhängig vom Text-Kanal
  try {
    const voiceOptions = {
      name: `🔊 ${team.name}`,
      type: ChannelType.GuildVoice,
      permissionOverwrites: overwrites,
    };
    if (voiceMarker.parent) voiceOptions.parent = voiceMarker.parent;
    const voice = await discordGuild.channels.create(voiceOptions);
    if (voiceMarker.position !== null) {
      await voice.setPosition(voiceMarker.position + 1, { relative: false }).catch(() => {});
    }
    voiceId = voice.id;
  } catch (err) {
    logger.warn(`Gilden-Voicekanal für "${team.name}" konnte nicht erstellt werden: ${err.message}`);
  }

  return { categoryId: null, chatId, newsId: null, voiceId };
}

async function deleteGuildChannels(discordGuild, team) {
  const ids = [team.channels?.voiceId, team.channels?.newsId, team.channels?.chatId, team.channels?.categoryId];
  for (const id of ids) {
    if (!id) continue;
    try {
      const ch = await discordGuild.channels.fetch(id).catch(() => null);
      if (ch) await ch.delete();
    } catch (err) {
      logger.warn(`Gilden-Kanal ${id} konnte nicht gelöscht werden: ${err.message}`);
    }
  }
}

async function syncGuildChannelPerms(discordGuild, team) {
  const overwrites = buildGuildOverwrites(discordGuild, team);

  const chat = team.channels?.chatId
    ? await discordGuild.channels.fetch(team.channels.chatId).catch(() => null) : null;
  if (chat) await chat.permissionOverwrites.set(overwrites).catch(() => {});

  const voice = team.channels?.voiceId
    ? await discordGuild.channels.fetch(team.channels.voiceId).catch(() => null) : null;
  if (voice) await voice.permissionOverwrites.set(overwrites).catch(() => {});
}

// ─── Button-Handler ───────────────────────────────────────────────────────────

async function handleGildenButton(interaction) {
  const payload = await getGildenPayload(interaction.guild.id, interaction.user.id);
  return interaction.reply({ ...payload, ephemeral: true });
}

async function handleGildenViewDetail(interaction) {
  const { guild, user } = interaction;
  const team = await GuildTeam.findOne({ guildId: guild.id, members: user.id });
  if (!team) return interaction.update({ content: '❌ Du bist in keiner Gilde.', embeds: [], components: [] });
  return interaction.update(buildGildenEmbed(team, user.id));
}

async function handleManageView(interaction) {
  const { guild, user } = interaction;
  const team = await GuildTeam.findOne({ guildId: guild.id, leaderId: user.id });
  if (!team) return interaction.reply({ content: '❌ Nur der Anführer kann die Gilde verwalten.', ephemeral: true });
  return interaction.reply({ ...buildManagePayload(team), ephemeral: true });
}

async function handleRangliste(interaction) {
  const { guild } = interaction;
  const teams = await GuildTeam.find({ guildId: guild.id }).sort({ treasury: -1 }).lean();

  if (!teams.length) {
    return interaction.reply({ content: '❌ Noch keine Gilden vorhanden.', ephemeral: true });
  }

  const medals = ['🥇', '🥈', '🥉'];
  const lines  = teams.map((t, i) => {
    const levelName = GUILD.LEVELS[t.level]?.name ?? '?';
    const prefix    = medals[i] ?? `**${i + 1}.**`;
    const memberCount = t.members?.length ?? 0;
    return `${prefix} **${t.name}** — Stufe ${t.level} (${levelName}) · ${formatCoins(t.treasury)} · 👥 ${memberCount}`;
  });

  const embed = createEmbed({
    title:       '🏆 Gilden-Rangliste',
    color:       COLORS.GOLD,
    description: lines.join('\n'),
  });

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleLeave(interaction) {
  const { guild, user } = interaction;
  const team = await GuildTeam.findOne({ guildId: guild.id, members: user.id });
  if (!team) return interaction.reply({ content: '❌ Du bist in keiner Gilde.', ephemeral: true });
  if (team.leaderId === user.id) {
    return interaction.reply({ content: '❌ Als Anführer kannst du nicht verlassen — löse die Gilde auf oder gib sie ab.', ephemeral: true });
  }
  const embed = createEmbed({
    title: '🚶 Gilde verlassen',
    color: COLORS.WARNING,
    description: `Möchtest du **${team.name}** wirklich verlassen?`,
  });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('gilden_leave_yes').setLabel('Ja, verlassen').setEmoji('🚶').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('gilden_leave_no').setLabel('Abbrechen').setEmoji('❌').setStyle(ButtonStyle.Secondary),
  );
  return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function handleLeaveExecute(interaction) {
  const { guild, user } = interaction;
  const team = await GuildTeam.findOne({ guildId: guild.id, members: user.id });
  if (!team) return interaction.update({ content: '❌ Gilde nicht gefunden.', embeds: [], components: [] });
  if (team.leaderId === user.id) {
    return interaction.update({ content: '❌ Als Anführer kannst du nicht verlassen.', embeds: [], components: [] });
  }
  const teamName = team.name;
  team.members = team.members.filter(id => id !== user.id);
  await team.save();
  if (team.roleId) {
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (member) await member.roles.remove(team.roleId).catch(() => {});
  } else {
    syncGuildChannelPerms(guild, team).catch(() => {});
  }
  return interaction.update({ content: `✅ Du hast die Gilde **${teamName}** verlassen.`, embeds: [], components: [] });
}

async function handleDisbandConfirm(interaction) {
  const { guild, user } = interaction;
  const team = await GuildTeam.findOne({ guildId: guild.id, leaderId: user.id });
  if (!team) return interaction.reply({ content: '❌ Nur der Anführer kann die Gilde auflösen.', ephemeral: true });

  const embed = createEmbed({
    title: '💀 Gilde auflösen',
    color: COLORS.ERROR,
    description: `Bist du sicher, dass du **${team.name}** auflösen willst?\n\n⚠️ Die Kasse von **${formatCoins(team.treasury)}** wird **nicht erstattet**.`,
  });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('gilden_disband_yes').setLabel('Ja, auflösen').setEmoji('💀').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('gilden_disband_no').setLabel('Abbrechen').setEmoji('❌').setStyle(ButtonStyle.Secondary),
  );
  return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function handleDisbandExecute(interaction) {
  const { guild, user } = interaction;
  const team = await GuildTeam.findOne({ guildId: guild.id, leaderId: user.id });
  if (!team) return interaction.update({ content: '❌ Gilde nicht gefunden.', embeds: [], components: [] });

  // Defer vor dem langsamen Kanallöschen
  await interaction.deferUpdate();
  await deleteGuildChannels(guild, team).catch(() => {});
  if (team.roleId) {
    await guild.roles.fetch(team.roleId).then(r => r?.delete()).catch(() => {});
  }
  await GuildTeam.deleteOne({ _id: team._id });
  return interaction.editReply({ content: `💀 Die Gilde **${team.name}** wurde aufgelöst.`, embeds: [], components: [] });
}

// ─── Modal anzeigen ───────────────────────────────────────────────────────────

function showCreateModal(interaction) {
  const modal = new ModalBuilder().setCustomId('modal_gilden_create').setTitle('Gilde gründen');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('name').setLabel('Gildenname').setStyle(TextInputStyle.Short).setMaxLength(32).setRequired(true),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('description').setLabel('Beschreibung (optional)').setStyle(TextInputStyle.Short).setMaxLength(200).setRequired(false).setPlaceholder('Kurze Beschreibung'),
    ),
  );
  return interaction.showModal(modal);
}

async function showDonateModal(interaction) {
  const { guild, user } = interaction;
  const team = await GuildTeam.findOne({ guildId: guild.id, members: user.id });
  const currentContrib = team ? (team.memberContributions?.get(user.id) ?? team.weeklyContribution ?? 0) : 0;

  const modal = new ModalBuilder().setCustomId('modal_gilden_donate').setTitle('In Kasse einzahlen');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('amount').setLabel('Einmalige Spende (optional)').setStyle(TextInputStyle.Short).setPlaceholder('z.B. 500').setRequired(false),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('weekly')
        .setLabel('Wochenbeitrag (leer = unverändert)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('z.B. 200')
        .setRequired(false)
        .setValue(currentContrib > 0 ? String(currentContrib) : ''),
    ),
  );
  return interaction.showModal(modal);
}

function showInviteModal(interaction) {
  const modal = new ModalBuilder().setCustomId('modal_gilden_invite').setTitle('Mitglied einladen');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('userId').setLabel('Discord-ID oder @Mention').setStyle(TextInputStyle.Short).setPlaceholder('z.B. 123456789012345678').setRequired(true),
    ),
  );
  return interaction.showModal(modal);
}

async function showKickSelect(interaction) {
  const { guild, user } = interaction;

  const team = await GuildTeam.findOne({ guildId: guild.id, leaderId: user.id });
  if (!team) return interaction.reply({ content: '❌ Nur der Anführer kann Mitglieder entfernen.', ephemeral: true });

  const eligible = team.members.filter(id => id !== user.id);
  if (!eligible.length) {
    return interaction.reply({ content: '❌ Keine Mitglieder zum Entfernen vorhanden.', ephemeral: true });
  }

  const options = [];
  for (const memberId of eligible) {
    const member = await guild.members.fetch(memberId).catch(() => null);
    options.push({
      label:       member ? member.displayName.slice(0, 100) : memberId,
      value:       memberId,
      description: member ? member.user.username.slice(0, 100) : 'Nutzer nicht gefunden',
    });
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(`gilden_kick_select_${team._id}`)
    .setPlaceholder('Mitglied auswählen…')
    .addOptions(options.slice(0, 25));

  return interaction.reply({
    content:    '🚪 Wen möchtest du aus der Gilde entfernen?',
    components: [new ActionRowBuilder().addComponents(select)],
    ephemeral:  true,
  });
}

// ─── Modal-Handler ────────────────────────────────────────────────────────────

async function handleCreate(interaction) {
  const { guild, user } = interaction;
  const name = interaction.fields.getTextInputValue('name').trim();
  const description = interaction.fields.getTextInputValue('description').trim() || null;

  if (BLACKLIST.some(w => name.toLowerCase().includes(w))) {
    return interaction.reply({ content: '❌ Dieser Name enthält unangemessene Begriffe.', ephemeral: true });
  }
  const existing = await GuildTeam.findOne({ guildId: guild.id, members: user.id });
  if (existing) return interaction.reply({ content: `❌ Du bist bereits in **${existing.name}**.`, ephemeral: true });

  const taken = await GuildTeam.findOne({ guildId: guild.id, name });
  if (taken) return interaction.reply({ content: `❌ Der Name **${name}** ist bereits vergeben.`, ephemeral: true });

  try {
    await coinService.removeCoins(guild.id, user.id, GUILD.FOUND_COST, 'guild', `Gilde gegründet: ${name}`);
  } catch (err) {
    return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
  }

  // Defer vor der langsamen Kanalerstellung (verhindert Interaction-Timeout)
  await interaction.deferReply({ ephemeral: true });

  const team = await GuildTeam.create({ guildId: guild.id, name, leaderId: user.id, members: [user.id], description });

  // Gilden-Rolle erstellen
  try {
    const role = await guild.roles.create({ name, mentionable: false, reason: `Gilden-Rolle: ${name}` });
    team.roleId = role.id;
    const leader = await guild.members.fetch(user.id).catch(() => null);
    if (leader) await leader.roles.add(role).catch(() => {});
  } catch (err) {
    logger.warn(`Gilden-Rolle für "${name}" konnte nicht erstellt werden: ${err.message}`);
  }

  try {
    const channelIds = await createGuildChannels(guild, team);
    team.channels = channelIds;
  } catch (err) {
    logger.warn(`Gilden-Kanäle für "${name}" konnten nicht erstellt werden: ${err.message}`);
  }

  await team.save();

  const payload = buildGildenEmbed(team);
  return interaction.editReply({ ...payload, content: `✅ Gilde **${name}** gegründet!` });
}

async function handleDonate(interaction) {
  const { guild, user } = interaction;
  const amountRaw = interaction.fields.getTextInputValue('amount').replace(/\D/g, '');
  const weeklyRaw = interaction.fields.getTextInputValue('weekly').replace(/\D/g, '');
  const amount  = amountRaw ? parseInt(amountRaw, 10) : null;
  const weekly  = weeklyRaw ? parseInt(weeklyRaw, 10) : null;

  if (amount === null && weekly === null) return interaction.reply({ content: '❌ Bitte mindestens einen Betrag angeben.', ephemeral: true });
  if (amount !== null && (isNaN(amount) || amount <= 0)) return interaction.reply({ content: '❌ Ungültige Einmalspende.', ephemeral: true });
  if (weekly !== null && (isNaN(weekly) || weekly < 0)) return interaction.reply({ content: '❌ Ungültiger Wochenbeitrag.', ephemeral: true });

  const team = await GuildTeam.findOne({ guildId: guild.id, members: user.id });
  if (!team) return interaction.reply({ content: '❌ Du bist in keiner Gilde.', ephemeral: true });

  const lines = [];

  if (amount !== null) {
    try {
      await coinService.removeCoins(guild.id, user.id, amount, 'guild', `Gildenspende: ${team.name}`);
    } catch (err) {
      return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
    team.treasury += amount;
    team.level = calcLevel(team.treasury);
    lines.push(`✅ <@${user.id}> hat **${formatCoins(amount)}** in die Kasse eingezahlt!`);
  }

  if (weekly !== null) {
    team.memberContributions.set(user.id, weekly);
    lines.push(weekly > 0
      ? `📅 Wochenbeitrag auf **${formatCoins(weekly)}** gesetzt.`
      : '📅 Wochenbeitrag deaktiviert.');
  }

  const payload = buildGildenEmbed(team);
  return interaction.reply({ ...payload, content: lines.join('\n'), ephemeral: true });
}

async function handleInvite(interaction) {
  const { guild, user } = interaction;
  const raw = interaction.fields.getTextInputValue('userId').trim().replace(/[<@!>]/g, '');

  const team = await GuildTeam.findOne({ guildId: guild.id, leaderId: user.id });
  if (!team) return interaction.reply({ content: '❌ Nur der Anführer kann Mitglieder einladen.', ephemeral: true });

  let target;
  try { target = await guild.members.fetch(raw); }
  catch { return interaction.reply({ content: '❌ Nutzer nicht gefunden.', ephemeral: true }); }

  if (target.user.bot) return interaction.reply({ content: '❌ Bots können keine Mitglieder sein.', ephemeral: true });
  if (team.members.includes(target.id)) return interaction.reply({ content: '❌ Bereits Mitglied.', ephemeral: true });

  const other = await GuildTeam.findOne({ guildId: guild.id, members: target.id });
  if (other) return interaction.reply({ content: `❌ <@${target.id}> ist bereits in **${other.name}**.`, ephemeral: true });

  team.members.push(target.id);
  await team.save();
  if (team.roleId) await target.roles.add(team.roleId).catch(() => {});
  else syncGuildChannelPerms(guild, team).catch(() => {});

  const payload = buildGildenEmbed(team);
  return interaction.reply({ ...payload, content: `✅ <@${target.id}> wurde eingeladen!`, ephemeral: true });
}

async function handleKickSelect(interaction) {
  const teamId   = interaction.customId.slice('gilden_kick_select_'.length);
  const { guild, user } = interaction;
  const targetId = interaction.values[0];

  const team = await GuildTeam.findById(teamId);
  if (!team || team.leaderId !== user.id) {
    return interaction.update({ content: '❌ Keine Berechtigung.', components: [] });
  }
  if (!team.members.includes(targetId)) {
    return interaction.update({ content: '❌ Kein Mitglied dieser Gilde.', components: [] });
  }

  team.members = team.members.filter(id => id !== targetId);
  await team.save();

  if (team.roleId) {
    const kicked = await guild.members.fetch(targetId).catch(() => null);
    if (kicked) await kicked.roles.remove(team.roleId).catch(() => {});
  } else {
    syncGuildChannelPerms(guild, team).catch(() => {});
  }

  return interaction.update({ content: `✅ <@${targetId}> wurde aus der Gilde entfernt.`, components: [] });
}

function showManifestModal(interaction) {
  const modal = new ModalBuilder().setCustomId('modal_gilden_manifest').setTitle('Manifest bearbeiten');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('manifest')
        .setLabel('Manifest / Programm der Gilde')
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(300)
        .setRequired(false)
        .setPlaceholder('Beschreibe die politische Ausrichtung deiner Gilde…'),
    ),
  );
  return interaction.showModal(modal);
}

async function handleManifest(interaction) {
  const { guild, user } = interaction;
  const team = await GuildTeam.findOne({ guildId: guild.id, leaderId: user.id });
  if (!team) return interaction.reply({ content: '❌ Nur der Anführer kann das Manifest bearbeiten.', ephemeral: true });

  const text = interaction.fields.getTextInputValue('manifest').trim() || null;
  team.description = text;
  await team.save();

  const payload = buildGildenEmbed(team);
  return interaction.reply({
    ...payload,
    content: text ? '✅ Manifest aktualisiert.' : '✅ Manifest gelöscht.',
    ephemeral: true,
  });
}

// ─── Leiterlose Gilde beitreten ──────────────────────────────────────────────

async function handleJoin(interaction) {
  const { guild } = interaction;
  const existing = await GuildTeam.findOne({ guildId: guild.id, members: interaction.user.id });
  if (existing) {
    return interaction.reply({ content: `❌ Du bist bereits in **${existing.name}**.`, ephemeral: true });
  }

  const allTeams = await GuildTeam.find({ guildId: guild.id }).lean();
  if (!allTeams.length) {
    return interaction.reply({ content: '❌ Keine Gilden vorhanden.', ephemeral: true });
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId('gilden_join_select')
    .setPlaceholder('Gilde auswählen…')
    .addOptions(allTeams.slice(0, 25).map(t => ({
      label:       t.name,
      value:       t._id.toString(),
      description: t.leaderless
        ? `Kein Anführer — direkt beitreten`
        : `Beitritt per Anfrage an den Anführer`,
    })));

  return interaction.reply({
    content: '🤝 Welcher Gilde möchtest du beitreten?',
    components: [new ActionRowBuilder().addComponents(select)],
    ephemeral: true,
  });
}

async function handleJoinSelect(interaction) {
  const { guild, user } = interaction;
  const teamId = interaction.values[0];

  const existing = await GuildTeam.findOne({ guildId: guild.id, members: user.id });
  if (existing) {
    return interaction.update({ content: `❌ Du bist bereits in **${existing.name}**.`, components: [] });
  }

  const team = await GuildTeam.findById(teamId);
  if (!team) {
    return interaction.update({ content: '❌ Gilde nicht gefunden.', components: [] });
  }

  // Leiterlose Gilde: Führungsübernahme anbieten
  if (team.leaderless) {
    const embed = createEmbed({
      title: `👑 Führung übernehmen`,
      color: COLORS.PRIMARY,
      description:
        `**${team.name}** hat keinen Anführer.\n\n` +
        `Möchtest du die Führung für **${formatCoins(GUILD.CLAIM_COST)}** übernehmen?`,
    });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`gilden_join_claim_${team._id}`)
        .setLabel(`Führung übernehmen (${formatCoins(GUILD.CLAIM_COST)})`)
        .setEmoji('👑')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('gilden_join_cancel')
        .setLabel('Abbrechen')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Secondary),
    );
    return interaction.update({ embeds: [embed], components: [row] });
  }

  // Gilde mit Anführer: Anfrage senden
  if (team.pendingRequests.includes(user.id)) {
    return interaction.update({ content: `❌ Du hast bereits eine offene Anfrage bei **${team.name}**.`, components: [] });
  }

  team.pendingRequests.push(user.id);
  await team.save();

  sendDmNotification(
    interaction.client,
    guild.id,
    team.leaderId,
    `📥 <@${user.id}> möchte der Gilde **${team.name}** beitreten.`,
  );

  await Offer.create({
    guildId:   guild.id,
    senderId:  user.id,
    targetId:  team.leaderId,
    type:      'guild_join',
    channelId: team._id.toString(),
    price:     0,
  });

  return interaction.update({ content: `✅ Deine Beitrittsanfrage wurde an den Anführer von **${team.name}** gesendet! Er sieht sie in seinem Gilden-Menü.`, components: [] });
}

async function handleJoinClaimConfirm(interaction) {
  const teamId = interaction.customId.slice('gilden_join_claim_'.length);
  const { guild, user } = interaction;

  const existing = await GuildTeam.findOne({ guildId: guild.id, members: user.id });
  if (existing) {
    return interaction.update({ content: `❌ Du bist bereits in **${existing.name}**.`, embeds: [], components: [] });
  }

  const team = await GuildTeam.findById(teamId);
  if (!team || !team.leaderless) {
    return interaction.update({ content: '❌ Diese Gilde hat bereits einen Anführer.', embeds: [], components: [] });
  }

  try {
    await coinService.removeCoins(guild.id, user.id, GUILD.CLAIM_COST, 'guild', `Führung übernommen: ${team.name}`);
  } catch (err) {
    return interaction.update({ content: `❌ ${err.message}`, embeds: [], components: [] });
  }

  team.leaderId   = user.id;
  team.leaderless = false;
  if (!team.members.includes(user.id)) team.members.push(user.id);

  if (!team.roleId) {
    try {
      const role = await guild.roles.create({ name: team.name, mentionable: false, reason: `Gilden-Rolle: ${team.name}` });
      team.roleId = role.id;
    } catch (err) {
      logger.warn(`Gilden-Rolle für "${team.name}" konnte nicht erstellt werden: ${err.message}`);
    }
  }

  if (team.roleId) {
    for (const memberId of team.members) {
      const member = await guild.members.fetch(memberId).catch(() => null);
      if (member) await member.roles.add(team.roleId).catch(() => {});
    }
  }

  if (!team.channels?.chatId) {
    try {
      const channelIds = await createGuildChannels(guild, team);
      team.channels = channelIds;
    } catch (err) {
      logger.warn(`Gilden-Kanäle für "${team.name}" konnten nicht erstellt werden: ${err.message}`);
    }
  } else {
    // Kanäle existieren bereits (z.B. Test-Gilde) — Berechtigungen mit neuer Rolle synchen
    syncGuildChannelPerms(guild, team).catch(() => {});
  }

  await team.save();

  return interaction.update({ content: `👑 Du hast die Führung von **${team.name}** übernommen!`, embeds: [], components: [] });
}

async function handleAnfragenAnnehmen(interaction) {
  const { guild, user } = interaction;
  const team = await GuildTeam.findOne({ guildId: guild.id, leaderId: user.id });
  if (!team) return interaction.reply({ content: '❌ Nur der Anführer kann Anfragen bearbeiten.', ephemeral: true });

  const pending = team.pendingRequests ?? [];
  if (!pending.length) return interaction.reply({ content: '❌ Keine offenen Anfragen.', ephemeral: true });

  const options = [];
  for (const userId of pending) {
    const member = await guild.members.fetch(userId).catch(() => null);
    options.push({
      label:       member ? member.displayName.slice(0, 100) : userId,
      value:       userId,
      description: member ? member.user.username.slice(0, 100) : 'Nutzer nicht gefunden',
    });
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(`gilden_anfragen_annehmen_select_${team._id}`)
    .setPlaceholder('Mitglied auswählen…')
    .addOptions(options.slice(0, 25));

  return interaction.reply({
    content:    '✅ Wen möchtest du aufnehmen?',
    components: [new ActionRowBuilder().addComponents(select)],
    ephemeral:  true,
  });
}

async function handleAnfragenAnnehmenSelect(interaction) {
  const teamId   = interaction.customId.slice('gilden_anfragen_annehmen_select_'.length);
  const { guild, user } = interaction;
  const targetId = interaction.values[0];

  const team = await GuildTeam.findById(teamId);
  if (!team || team.leaderId !== user.id) {
    return interaction.update({ content: '❌ Keine Berechtigung.', components: [] });
  }

  team.pendingRequests = team.pendingRequests.filter(id => id !== targetId);

  if (!team.members.includes(targetId)) {
    const other = await GuildTeam.findOne({ guildId: guild.id, members: targetId });
    if (other) {
      await team.save();
      return interaction.update({ content: `❌ <@${targetId}> ist bereits in **${other.name}**.`, components: [] });
    }
    team.members.push(targetId);
  }

  await team.save();

  const member = await guild.members.fetch(targetId).catch(() => null);
  if (team.roleId && member) await member.roles.add(team.roleId).catch(() => {});
  else syncGuildChannelPerms(guild, team).catch(() => {});

  sendDmNotification(interaction.client, guild.id, targetId, `✅ Deine Beitrittsanfrage bei **${team.name}** wurde angenommen! Du bist jetzt Mitglied.`);

  await Offer.create({
    guildId:     guild.id,
    senderId:    user.id,
    targetId,
    type:        'notification',
    description: `✅ Deine Beitrittsanfrage bei **${team.name}** wurde angenommen! Du bist jetzt Mitglied.`,
    price:       0,
  });

  return interaction.update({ content: `✅ <@${targetId}> wurde in **${team.name}** aufgenommen!`, components: [] });
}

async function handleAnfragenAblehnen(interaction) {
  const { guild, user } = interaction;
  const team = await GuildTeam.findOne({ guildId: guild.id, leaderId: user.id });
  if (!team) return interaction.reply({ content: '❌ Nur der Anführer kann Anfragen bearbeiten.', ephemeral: true });

  const pending = team.pendingRequests ?? [];
  if (!pending.length) return interaction.reply({ content: '❌ Keine offenen Anfragen.', ephemeral: true });

  const options = [];
  for (const userId of pending) {
    const member = await guild.members.fetch(userId).catch(() => null);
    options.push({
      label:       member ? member.displayName.slice(0, 100) : userId,
      value:       userId,
      description: member ? member.user.username.slice(0, 100) : 'Nutzer nicht gefunden',
    });
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(`gilden_anfragen_ablehnen_select_${team._id}`)
    .setPlaceholder('Mitglied auswählen…')
    .addOptions(options.slice(0, 25));

  return interaction.reply({
    content:    '❌ Wen möchtest du ablehnen?',
    components: [new ActionRowBuilder().addComponents(select)],
    ephemeral:  true,
  });
}

async function handleAnfragenAblehnenSelect(interaction) {
  const teamId   = interaction.customId.slice('gilden_anfragen_ablehnen_select_'.length);
  const { user } = interaction;
  const targetId = interaction.values[0];

  const team = await GuildTeam.findById(teamId);
  if (!team || team.leaderId !== user.id) {
    return interaction.update({ content: '❌ Keine Berechtigung.', components: [] });
  }

  team.pendingRequests = team.pendingRequests.filter(id => id !== targetId);
  await team.save();

  sendDmNotification(interaction.client, team.guildId, targetId, `❌ Deine Beitrittsanfrage bei **${team.name}** wurde abgelehnt.`);

  await Offer.create({
    guildId:     team.guildId,
    senderId:    user.id,
    targetId,
    type:        'notification',
    description: `❌ Deine Beitrittsanfrage bei **${team.name}** wurde abgelehnt.`,
    price:       0,
  });

  return interaction.update({ content: `❌ Beitrittsanfrage von <@${targetId}> abgelehnt.`, components: [] });
}

// ─── Gilden-News ─────────────────────────────────────────────────────────────

function buildNewsPayload(team, page, isLeader) {
  const teamId = team._id.toString();
  const news   = (team.news ?? []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const total  = news.length;

  if (!total) {
    const embed = createEmbed({
      title:       '📰 Gilden-Neuigkeiten',
      color:       COLORS.PRIMARY,
      description: '*Noch keine Neuigkeiten vorhanden.*',
    });
    const components = isLeader
      ? [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('gilden_news_add').setLabel('Neuigkeit hinzufügen').setEmoji('➕').setStyle(ButtonStyle.Primary),
        )]
      : [];
    return { embeds: [embed], components };
  }

  const p    = Math.max(0, Math.min(page, total - 1));
  const item = news[p];
  const d    = new Date(item.createdAt);
  const dateStr = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;

  const embed = createEmbed({
    title:       '📰 Gilden-Neuigkeiten',
    color:       COLORS.PRIMARY,
    description: item.content,
    fields:      [{ name: 'Verfasst von', value: `<@${item.authorId}>`, inline: true }],
    footer:      `Seite ${p + 1} / ${total} · ${dateStr}`,
  });

  const buttons = [
    new ButtonBuilder()
      .setCustomId(p > 0 ? `gilden_news_page_${teamId}_${p - 1}` : 'gilden_news_noop')
      .setLabel('◀ Zurück')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(p === 0),
    new ButtonBuilder()
      .setCustomId(p < total - 1 ? `gilden_news_page_${teamId}_${p + 1}` : 'gilden_news_noop2')
      .setLabel('Weiter ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(p === total - 1),
  ];
  if (isLeader) {
    buttons.push(
      new ButtonBuilder().setCustomId('gilden_news_add').setLabel('Hinzufügen').setEmoji('➕').setStyle(ButtonStyle.Primary),
    );
  }

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(buttons)] };
}

async function handleNewsView(interaction) {
  const { guild, user } = interaction;
  const team = await GuildTeam.findOne({ guildId: guild.id, members: user.id });
  if (!team) return interaction.reply({ content: '❌ Du bist in keiner Gilde.', ephemeral: true });
  return interaction.reply({ ...buildNewsPayload(team, 0, team.leaderId === user.id), ephemeral: true });
}

async function handleNewsPage(interaction) {
  const parts  = interaction.customId.split('_');
  const page   = parseInt(parts.at(-1), 10);
  const teamId = parts.at(-2);

  const team = await GuildTeam.findById(teamId);
  if (!team) return interaction.update({ content: '❌ Gilde nicht gefunden.', embeds: [], components: [] });
  return interaction.update(buildNewsPayload(team, page, team.leaderId === interaction.user.id));
}

function showNewsAddModal(interaction) {
  const modal = new ModalBuilder().setCustomId('modal_gilden_news_add').setTitle('Neuigkeit hinzufügen');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('content')
        .setLabel('Neuigkeit')
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(500)
        .setRequired(true)
        .setPlaceholder('Was gibt es Neues in eurer Gilde?'),
    ),
  );
  return interaction.showModal(modal);
}

async function handleNewsAdd(interaction) {
  const { guild, user } = interaction;
  const content = interaction.fields.getTextInputValue('content').trim();

  const team = await GuildTeam.findOne({ guildId: guild.id, leaderId: user.id });
  if (!team) return interaction.reply({ content: '❌ Nur der Anführer kann Neuigkeiten hinzufügen.', ephemeral: true });

  team.news.push({ content, authorId: user.id });
  // Maximal 20 Neuigkeiten speichern (älteste zuerst entfernen)
  if (team.news.length > 20) team.news = team.news.slice(-20);
  await team.save();

  const payload = buildNewsPayload(team, 0, true);
  return interaction.reply({ ...payload, ephemeral: true });
}

// ─── Gilden-Rolle Farbe ───────────────────────────────────────────────────────

function showRoleColorModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('modal_gilden_role_color')
    .setTitle('Gilden-Rolle anpassen');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('color')
        .setLabel('Farbe (HEX, z.B. #FF5500)')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(7)
        .setRequired(true)
        .setPlaceholder('#FF5500'),
    ),
  );
  return interaction.showModal(modal);
}

async function handleRoleColor(interaction) {
  const { guild, user } = interaction;
  const colorInput = interaction.fields.getTextInputValue('color').trim();

  if (!/^#[0-9A-Fa-f]{6}$/.test(colorInput)) {
    return interaction.reply({ content: '❌ Ungültige Farbe. Bitte das Format `#RRGGBB` verwenden (z.B. `#FF5500`).', ephemeral: true });
  }

  const team = await GuildTeam.findOne({ guildId: guild.id, leaderId: user.id });
  if (!team) return interaction.reply({ content: '❌ Nur der Anführer kann die Rolle anpassen.', ephemeral: true });
  if (team.level < 1) return interaction.reply({ content: '❌ Diese Funktion ist erst ab Stufe 1 verfügbar.', ephemeral: true });
  if (!team.roleId) return interaction.reply({ content: '❌ Deine Gilde hat keine Rolle.', ephemeral: true });

  try {
    const role = await guild.roles.fetch(team.roleId);
    await role.edit({ color: colorInput });
    const payload = buildGildenEmbed(team, user.id);
    return interaction.reply({ ...payload, content: `✅ Gildenrollen-Farbe auf **${colorInput}** gesetzt.`, ephemeral: true });
  } catch (err) {
    logger.warn(`Gilden-Rolle Farbe konnte nicht geändert werden: ${err.message}`);
    return interaction.reply({ content: `❌ Farbe konnte nicht geändert werden: ${err.message}`, ephemeral: true });
  }
}

// ─── Personal ────────────────────────────────────────────────────────────────

async function buildPersonalPayload(team, discordGuild) {
  const level      = team.level;
  const staffRoles = team.staffRoles ?? {};
  const fields     = [];

  for (const [, cfg] of Object.entries(STAFF_CONFIG)) {
    if (level < cfg.minLevel) continue;

    const roleId = staffRoles[cfg.roleKey];
    let value;

    if (!roleId) {
      value = '*(noch nicht eingerichtet)*';
    } else {
      try {
        const role    = await discordGuild.roles.fetch(roleId);
        const members = [...(role?.members?.values() ?? [])];
        value = members.length ? members.map(m => `<@${m.id}>`).join(', ') : '*(niemand ernannt)*';
      } catch {
        value = '*(Rolle nicht gefunden)*';
      }
    }

    fields.push({ name: `${cfg.emoji} ${cfg.label}`, value, inline: true });
  }

  const embed = createEmbed({
    title:       '👥 Gilden-Personal',
    color:       COLORS.PRIMARY,
    description: `Personal-Verwaltung für **${team.name}** — Stufe ${level}`,
    fields,
  });

  const rows = [];
  for (const [type, cfg] of Object.entries(STAFF_CONFIG)) {
    if (level < cfg.minLevel) continue;
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`gilden_personal_ernennen_${type}`)
        .setLabel(`${cfg.label} ernennen`)
        .setEmoji(cfg.emoji)
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`gilden_personal_entlassen_${type}`)
        .setLabel(`${cfg.label} entlassen`)
        .setEmoji('🚫')
        .setStyle(ButtonStyle.Danger),
    ));
    if (rows.length >= 4) break;
  }

  return { embeds: [embed], components: rows };
}

async function handlePersonalView(interaction) {
  const { guild, user } = interaction;
  const team = await GuildTeam.findOne({ guildId: guild.id, leaderId: user.id });
  if (!team) return interaction.reply({ content: '❌ Nur der Anführer kann das Personal verwalten.', ephemeral: true });
  if (team.level < 2) return interaction.reply({ content: '❌ Diese Funktion ist erst ab Stufe 2 (Dorf) verfügbar.', ephemeral: true });

  const payload = await buildPersonalPayload(team, guild);
  return interaction.reply({ ...payload, ephemeral: true });
}

async function handlePersonalErnennen(interaction) {
  const type = interaction.customId.replace('gilden_personal_ernennen_', '');
  const cfg  = STAFF_CONFIG[type];
  if (!cfg) return interaction.reply({ content: '❌ Unbekannter Typ.', ephemeral: true });

  const { guild, user } = interaction;
  const team = await GuildTeam.findOne({ guildId: guild.id, leaderId: user.id });
  if (!team) return interaction.reply({ content: '❌ Nur der Anführer kann Personal ernennen.', ephemeral: true });
  if (team.level < cfg.minLevel) {
    return interaction.reply({ content: `❌ Diese Funktion ist erst ab Stufe ${cfg.minLevel} verfügbar.`, ephemeral: true });
  }

  const options = [];
  for (const memberId of team.members) {
    if (memberId === user.id) continue;
    const member = await guild.members.fetch(memberId).catch(() => null);
    if (!member) continue;
    options.push({
      label:       member.displayName.slice(0, 100),
      value:       memberId,
      description: member.user.username.slice(0, 100),
    });
  }

  if (!options.length) return interaction.reply({ content: '❌ Keine Mitglieder zum Ernennen vorhanden.', ephemeral: true });

  const select = new StringSelectMenuBuilder()
    .setCustomId(`gilden_personal_ernennen_select_${team._id}_${type}`)
    .setPlaceholder(`${cfg.label} auswählen…`)
    .addOptions(options.slice(0, 25));

  return interaction.reply({
    content:    `${cfg.emoji} Wen möchtest du zum **${cfg.label}** ernennen?`,
    components: [new ActionRowBuilder().addComponents(select)],
    ephemeral:  true,
  });
}

async function handlePersonalErnennenSelect(interaction) {
  // customId: gilden_personal_ernennen_select_{teamId}_{type}
  const parts    = interaction.customId.split('_');
  const type     = parts.at(-1);
  const teamId   = parts.at(-2);
  const cfg      = STAFF_CONFIG[type];
  if (!cfg) return interaction.update({ content: '❌ Unbekannter Typ.', components: [] });

  const { guild, user } = interaction;
  const targetId = interaction.values[0];

  const team = await GuildTeam.findById(teamId);
  if (!team || team.leaderId !== user.id) {
    return interaction.update({ content: '❌ Keine Berechtigung.', components: [] });
  }

  // Stelle sicher, dass die Personalrolle existiert
  let roleId = team.staffRoles?.[cfg.roleKey];
  if (!roleId) {
    try {
      const role = await guild.roles.create({
        name:        `${team.name} · ${cfg.label}`,
        permissions: cfg.permissions,
        mentionable: false,
        reason:      `Gilden-Personal: ${cfg.label}`,
      });
      team.staffRoles = team.staffRoles ?? {};
      team.staffRoles[cfg.roleKey] = role.id;
      team.markModified('staffRoles');
      await team.save();
      roleId = role.id;
    } catch (err) {
      logger.warn(`Gilden-Personalrolle konnte nicht erstellt werden: ${err.message}`);
      return interaction.update({ content: `❌ Rolle konnte nicht erstellt werden: ${err.message}`, components: [] });
    }
  }

  try {
    const member = await guild.members.fetch(targetId);
    await member.roles.add(roleId);
    return interaction.update({ content: `✅ <@${targetId}> wurde zum **${cfg.label}** ernannt!`, components: [] });
  } catch (err) {
    return interaction.update({ content: `❌ Rolle konnte nicht zugewiesen werden: ${err.message}`, components: [] });
  }
}

async function handlePersonalEntlassen(interaction) {
  const type = interaction.customId.replace('gilden_personal_entlassen_', '');
  const cfg  = STAFF_CONFIG[type];
  if (!cfg) return interaction.reply({ content: '❌ Unbekannter Typ.', ephemeral: true });

  const { guild, user } = interaction;
  const team = await GuildTeam.findOne({ guildId: guild.id, leaderId: user.id });
  if (!team) return interaction.reply({ content: '❌ Nur der Anführer kann Personal entlassen.', ephemeral: true });

  const roleId = team.staffRoles?.[cfg.roleKey];
  if (!roleId) return interaction.reply({ content: `❌ Kein **${cfg.label}** eingerichtet.`, ephemeral: true });

  let role;
  try {
    role = await guild.roles.fetch(roleId);
  } catch {
    return interaction.reply({ content: '❌ Rolle nicht gefunden.', ephemeral: true });
  }

  const members = [...(role?.members?.values() ?? [])];
  if (!members.length) {
    return interaction.reply({ content: `❌ Niemand hat aktuell die **${cfg.label}**-Rolle.`, ephemeral: true });
  }

  const options = members.map(m => ({
    label:       m.displayName.slice(0, 100),
    value:       m.id,
    description: m.user.username.slice(0, 100),
  }));

  const select = new StringSelectMenuBuilder()
    .setCustomId(`gilden_personal_entlassen_select_${team._id}_${type}`)
    .setPlaceholder(`${cfg.label} entlassen…`)
    .addOptions(options.slice(0, 25));

  return interaction.reply({
    content:    `🚫 Wen möchtest du als **${cfg.label}** entlassen?`,
    components: [new ActionRowBuilder().addComponents(select)],
    ephemeral:  true,
  });
}

async function handlePersonalEntlassenSelect(interaction) {
  // customId: gilden_personal_entlassen_select_{teamId}_{type}
  const parts    = interaction.customId.split('_');
  const type     = parts.at(-1);
  const teamId   = parts.at(-2);
  const cfg      = STAFF_CONFIG[type];
  if (!cfg) return interaction.update({ content: '❌ Unbekannter Typ.', components: [] });

  const { guild, user } = interaction;
  const targetId = interaction.values[0];

  const team = await GuildTeam.findById(teamId);
  if (!team || team.leaderId !== user.id) {
    return interaction.update({ content: '❌ Keine Berechtigung.', components: [] });
  }

  const roleId = team.staffRoles?.[cfg.roleKey];
  if (!roleId) return interaction.update({ content: `❌ Keine ${cfg.label}-Rolle gefunden.`, components: [] });

  try {
    const member = await guild.members.fetch(targetId);
    await member.roles.remove(roleId);
    return interaction.update({ content: `✅ <@${targetId}> wurde als **${cfg.label}** entlassen.`, components: [] });
  } catch (err) {
    return interaction.update({ content: `❌ Rolle konnte nicht entfernt werden: ${err.message}`, components: [] });
  }
}

async function handleClaimLeadership(interaction) {
  const { guild, user } = interaction;

  const team = await GuildTeam.findOne({ guildId: guild.id, members: user.id, leaderless: true });
  if (!team) {
    return interaction.reply({ content: '❌ Du bist in keiner führerlosen Gilde.', ephemeral: true });
  }

  try {
    await coinService.removeCoins(guild.id, user.id, GUILD.CLAIM_COST, 'guild', `Führung übernommen: ${team.name}`);
  } catch (err) {
    return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
  }

  team.leaderId  = user.id;
  team.leaderless = false;

  // Gilden-Rolle erstellen falls noch nicht vorhanden
  if (!team.roleId) {
    try {
      const role = await guild.roles.create({ name: team.name, mentionable: false, reason: `Gilden-Rolle: ${team.name}` });
      team.roleId = role.id;
    } catch (err) {
      logger.warn(`Gilden-Rolle für "${team.name}" konnte nicht erstellt werden: ${err.message}`);
    }
  }

  // Rolle an alle Mitglieder vergeben (inkl. neuem Anführer)
  if (team.roleId) {
    for (const memberId of team.members) {
      const member = await guild.members.fetch(memberId).catch(() => null);
      if (member) await member.roles.add(team.roleId).catch(() => {});
    }
  }

  // Kanäle erstellen falls noch nicht vorhanden
  if (!team.channels?.chatId) {
    try {
      const channelIds = await createGuildChannels(guild, team);
      team.channels = channelIds;
    } catch (err) {
      logger.warn(`Gilden-Kanäle für "${team.name}" konnten nicht erstellt werden: ${err.message}`);
    }
  } else {
    // Kanäle existieren bereits — Berechtigungen mit neuer Rolle synchen
    syncGuildChannelPerms(guild, team).catch(() => {});
  }

  await team.save();

  const payload = buildGildenEmbed(team);
  return interaction.reply({ ...payload, content: `👑 Du hast die Führung von **${team.name}** übernommen!`, ephemeral: true });
}

// ─── Gilden-Aufgaben (einmalig & dauerhaft) ───────────────────────────────────

const GuildTask = require('../models/GuildTask');

function calcTotalContrib(team) {
  return team.members.reduce((sum, id) => {
    const personal = team.memberContributions?.get(id);
    return sum + (personal != null ? personal : (team.weeklyContribution ?? 0));
  }, 0);
}

// ── Leader-Verwaltung ─────────────────────────────────────────────────────────

async function handleAufgabenManage(interaction) {
  const { guild, user } = interaction;
  const team = await GuildTeam.findOne({ guildId: guild.id, leaderId: user.id });
  if (!team) return interaction.reply({ content: '❌ Nur der Anführer kann Aufgaben verwalten.', ephemeral: true });

  const tasks = await GuildTask.find({ teamId: team._id.toString() }).lean();
  const einmalig   = tasks.filter(t => t.type === 'einmalig');
  const dauerhaft  = tasks.filter(t => t.type === 'dauerhaft');

  const totalSalary  = dauerhaft.reduce((s, t) => s + t.reward * (t.assignees?.length ?? 0), 0);
  const totalContrib = calcTotalContrib(team);
  const balanceOk    = totalContrib >= totalSalary;

  const einmaligLines = einmalig.length
    ? einmalig.map(t => {
        const assigned = t.assignees?.length ?? 0;
        const pending  = t.applicants?.length ?? 0;
        return `• **${t.title}** — ${formatCoins(t.reward)} · ${assigned}/${t.slots} belegt · ${pending} Bewerbung(en)`;
      }).join('\n')
    : '*Keine einmaligen Aufgaben vorhanden.*';

  const dauerhaftLines = dauerhaft.length
    ? dauerhaft.map(t => {
        const assigned = t.assignees?.length ?? 0;
        const pending  = t.applicants?.length ?? 0;
        return `• **${t.title}** — ${formatCoins(t.reward)}/Woche · ${assigned}/${t.slots} belegt · ${pending} Bewerbung(en)`;
      }).join('\n')
    : '*Keine dauerhaften Aufgaben vorhanden.*';

  const fields = [
    { name: '📋 Einmalige Aufgaben', value: einmaligLines },
    { name: '💼 Dauerhafte Aufgaben', value: dauerhaftLines },
  ];

  if (dauerhaft.length > 0) {
    const balanceText = balanceOk
      ? '✅ Wochenbeiträge decken alle Gehälter.'
      : `⚠️ Fehlbetrag: **${formatCoins(totalSalary - totalContrib)}** — Beitrag erhöhen oder Stellen streichen!`;
    fields.push(
      { name: '💸 Gesamtgehälter / Woche', value: formatCoins(totalSalary), inline: true },
      { name: '📥 Wochenbeiträge gesamt', value: formatCoins(totalContrib), inline: true },
      { name: 'Bilanz', value: balanceText },
    );
  }

  const embed = createEmbed({
    title:  `📋 Aufgaben — ${team.name}`,
    color:  balanceOk ? COLORS.PRIMARY : COLORS.WARNING,
    fields,
    footer: `Kasse: ${formatCoins(team.treasury)}`,
  });

  const hasApplicants = tasks.some(t => t.applicants?.length > 0);
  const hasTasks      = tasks.length > 0;

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('aufgabe_create_einmalig').setLabel('Einmalig erstellen').setEmoji('📋').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('aufgabe_create_dauerhaft').setLabel('Dauerhaft erstellen').setEmoji('💼').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('aufgabe_applications').setLabel('Bewerbungen').setEmoji('👤').setStyle(ButtonStyle.Primary).setDisabled(!hasApplicants),
    new ButtonBuilder().setCustomId('aufgabe_remove').setLabel('Aufgabe löschen').setEmoji('🗑️').setStyle(ButtonStyle.Danger).setDisabled(!hasTasks),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('aufgabe_beitrag').setLabel('Wochenbeitrag').setEmoji('💰').setStyle(ButtonStyle.Secondary),
  );

  return interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
}

function showCreateAufgabeModal(interaction, type) {
  const isEinmalig = type === 'einmalig';
  const modal = new ModalBuilder()
    .setCustomId(`modal_aufgabe_${type}`)
    .setTitle(isEinmalig ? 'Einmalige Aufgabe erstellen' : 'Dauerhafte Aufgabe erstellen');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('title')
        .setLabel('Titel')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(60)
        .setRequired(true),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Beschreibung (optional)')
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(500)
        .setRequired(false)
        .setPlaceholder('Was muss erledigt werden?'),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('reward')
        .setLabel(isEinmalig ? 'Belohnung (Coins, aus Kasse)' : 'Wöchentliches Gehalt (Coins)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('z.B. 500')
        .setRequired(true),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('slots')
        .setLabel('Plätze (wie viele Personen)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('z.B. 1')
        .setRequired(false),
    ),
  );

  return interaction.showModal(modal);
}

async function handleCreateAufgabe(interaction, type) {
  const { guild, user } = interaction;
  const team = await GuildTeam.findOne({ guildId: guild.id, leaderId: user.id });
  if (!team) return interaction.reply({ content: '❌ Nur der Anführer kann Aufgaben erstellen.', ephemeral: true });

  const title  = interaction.fields.getTextInputValue('title').trim();
  const desc   = interaction.fields.getTextInputValue('description').trim() || null;
  const reward = parseInt(interaction.fields.getTextInputValue('reward').replace(/\D/g, ''), 10);
  const slotsRaw = interaction.fields.getTextInputValue('slots').trim();
  const slots  = slotsRaw ? parseInt(slotsRaw, 10) : 1;

  if (!reward || reward <= 0) return interaction.reply({ content: '❌ Ungültige Belohnung.', ephemeral: true });
  if (!slots || slots < 1)   return interaction.reply({ content: '❌ Ungültige Platzanzahl.', ephemeral: true });

  if (type === 'einmalig') {
    if (reward > team.treasury) {
      return interaction.reply({ content: `❌ Nicht genug in der Kasse! Verfügbar: **${formatCoins(team.treasury)}**`, ephemeral: true });
    }
  } else {
    // dauerhaft: prüfe ob Wochenbeiträge ausreichen
    const existingTasks  = await GuildTask.find({ teamId: team._id.toString(), type: 'dauerhaft' }).lean();
    const existingSalary = existingTasks.reduce((s, t) => s + t.reward * (t.assignees?.length ?? 0), 0);
    const newSalary      = existingSalary + reward * slots;
    const totalContrib   = calcTotalContrib(team);
    if (totalContrib < newSalary) {
      return interaction.reply({
        content: `❌ Wochenbeiträge reichen nicht!\n💸 Neue Gesamtgehälter: **${formatCoins(newSalary)}/Woche**\n📥 Beiträge: **${formatCoins(totalContrib)}/Woche**\n\nErhöhe den Wochenbeitrag oder senke das Gehalt.`,
        ephemeral: true,
      });
    }
  }

  await GuildTask.create({
    guildId:     guild.id,
    teamId:      team._id.toString(),
    title,
    description: desc,
    reward,
    type,
    slots,
  });

  const typeLabel = type === 'einmalig' ? 'Einmalige Aufgabe' : 'Dauerhafte Aufgabe';
  const rewardLabel = type === 'einmalig' ? formatCoins(reward) : `${formatCoins(reward)}/Woche`;
  return interaction.reply({
    content: `✅ ${typeLabel} **${title}** erstellt — ${rewardLabel} · ${slots} Platz/Plätze.`,
    ephemeral: true,
  });
}

async function showAufgabeApplicationsSelect(interaction) {
  const { guild, user } = interaction;
  const team = await GuildTeam.findOne({ guildId: guild.id, leaderId: user.id });
  if (!team) return interaction.reply({ content: '❌ Nur der Anführer kann Bewerbungen prüfen.', ephemeral: true });

  const tasks = await GuildTask.find({ teamId: team._id.toString(), 'applicants.0': { $exists: true } }).lean();
  const withSlots = tasks.filter(t => (t.assignees?.length ?? 0) < t.slots);

  if (!withSlots.length) return interaction.reply({ content: '❌ Keine offenen Bewerbungen oder alle Plätze belegt.', ephemeral: true });

  const options = withSlots.slice(0, 25).map(t => ({
    label:       t.title.slice(0, 100),
    description: `${t.applicants.length} Bewerbung(en) — ${t.type === 'dauerhaft' ? `${formatCoins(t.reward)}/Woche` : formatCoins(t.reward)}`,
    value:       t._id.toString(),
  }));

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId('aufgabe_applications_select').setPlaceholder('Aufgabe auswählen').addOptions(options),
  );
  return interaction.reply({ content: '📋 Für welche Aufgabe Bewerbungen prüfen?', components: [row], ephemeral: true });
}

async function handleAufgabeApplicationsSelect(interaction) {
  const { guild, user } = interaction;
  const taskId = interaction.values[0];

  const team = await GuildTeam.findOne({ guildId: guild.id, leaderId: user.id });
  if (!team) return interaction.update({ content: '❌ Nicht autorisiert.', components: [] });

  const task = await GuildTask.findById(taskId);
  if (!task) return interaction.update({ content: '❌ Aufgabe nicht gefunden.', components: [] });
  if ((task.assignees?.length ?? 0) >= task.slots) return interaction.update({ content: '❌ Alle Plätze sind bereits belegt.', components: [] });
  if (!task.applicants?.length) return interaction.update({ content: '❌ Keine Bewerbungen vorhanden.', components: [] });

  const members = await Promise.all(task.applicants.map(id => guild.members.fetch(id).catch(() => null)));
  const options = task.applicants.map((id, i) => ({
    label: (members[i]?.displayName ?? id).slice(0, 100),
    value: id,
  }));

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`aufgabe_applicant_select_${taskId}`)
      .setPlaceholder('Bewerber zuweisen')
      .addOptions(options),
  );
  return interaction.update({ content: `👤 Wen für **${task.title}** zuweisen?`, components: [row] });
}

async function handleAufgabeApplicantSelect(interaction) {
  const { guild, user } = interaction;
  const taskId = interaction.customId.replace('aufgabe_applicant_select_', '');
  const userId = interaction.values[0];

  const team = await GuildTeam.findOne({ guildId: guild.id, leaderId: user.id });
  if (!team) return interaction.update({ content: '❌ Nicht autorisiert.', components: [] });

  const task = await GuildTask.findById(taskId);
  if (!task) return interaction.update({ content: '❌ Aufgabe nicht gefunden.', components: [] });
  if ((task.assignees?.length ?? 0) >= task.slots) {
    return interaction.update({ content: '❌ Alle Plätze sind bereits belegt.', components: [] });
  }

  // Remove from applicants
  task.applicants = task.applicants.filter(id => id !== userId);

  if (task.type === 'einmalig') {
    // Create ticket channel
    const memberSlug = (await guild.members.fetch(userId).catch(() => null))
      ?.displayName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 15) ?? userId;
    const taskSlug = task.title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);

    const overwrites = [
      { id: guild.id, type: OverwriteType.Role, deny: [PermissionFlagsBits.ViewChannel] },
      { id: userId, type: OverwriteType.Member, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
    ];
    const leaderMember = await guild.members.fetch(team.leaderId).catch(() => null);
    if (leaderMember) {
      overwrites.push({ id: leaderMember.id, type: OverwriteType.Member, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
    }

    const channel = await guild.channels.create({
      name:                 `aufgabe-${taskSlug}-${memberSlug}`,
      type:                 ChannelType.GuildText,
      permissionOverwrites: overwrites,
    });

    task.assignees.push({ userId, channelId: channel.id });
    await task.save();

    const embed = createEmbed({
      title:       `📋 ${task.title}`,
      color:       COLORS.PRIMARY,
      description: task.description ?? 'Keine Beschreibung.',
      fields: [
        { name: 'Bearbeiter', value: `<@${userId}>`,          inline: true },
        { name: 'Belohnung',  value: formatCoins(task.reward), inline: true },
        { name: 'Anführer',   value: `<@${team.leaderId}>`,    inline: true },
      ],
      footer: 'Klicke auf "Abgeschlossen" wenn du fertig bist.',
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`aufgabe_submit_${task._id}_${userId}`)
        .setLabel('Abgeschlossen')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
    );

    await channel.send({ content: `<@${userId}> <@${team.leaderId}>`, embeds: [embed], components: [row] });
    return interaction.update({ content: `✅ <@${userId}> zugewiesen! Ticket: <#${channel.id}>`, components: [] });
  } else {
    // dauerhaft: kein Ticket
    task.assignees.push({ userId });
    await task.save();
    return interaction.update({ content: `✅ <@${userId}> für **${task.title}** eingestellt — ${formatCoins(task.reward)}/Woche.`, components: [] });
  }
}

async function showAufgabeDeleteSelect(interaction) {
  const { guild, user } = interaction;
  const team = await GuildTeam.findOne({ guildId: guild.id, leaderId: user.id });
  if (!team) return interaction.reply({ content: '❌ Nur der Anführer kann Aufgaben löschen.', ephemeral: true });

  const tasks = await GuildTask.find({ teamId: team._id.toString() }).lean();
  if (!tasks.length) return interaction.reply({ content: '❌ Keine Aufgaben vorhanden.', ephemeral: true });

  const options = tasks.slice(0, 25).map(t => ({
    label:       t.title.slice(0, 100),
    description: `${t.type === 'einmalig' ? 'Einmalig' : 'Dauerhaft'} · ${formatCoins(t.reward)}${t.type === 'dauerhaft' ? '/Woche' : ''}`,
    value:       t._id.toString(),
  }));

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId('aufgabe_delete_select').setPlaceholder('Aufgabe löschen…').addOptions(options),
  );
  return interaction.reply({ content: '🗑️ Welche Aufgabe löschen?', components: [row], ephemeral: true });
}

async function handleAufgabeDeleteSelect(interaction) {
  const { guild, user } = interaction;
  const taskId = interaction.values[0];

  const team = await GuildTeam.findOne({ guildId: guild.id, leaderId: user.id });
  if (!team) return interaction.update({ content: '❌ Keine Berechtigung.', components: [] });

  const task = await GuildTask.findById(taskId);
  if (!task || task.teamId !== team._id.toString()) {
    return interaction.update({ content: '❌ Aufgabe nicht gefunden.', components: [] });
  }

  const hasActiveAssignees = task.assignees?.some(a => a.status === 'active' || a.status === 'submitted');
  if (hasActiveAssignees) {
    return interaction.update({ content: `❌ **${task.title}** wird gerade bearbeitet und kann nicht gelöscht werden.`, components: [] });
  }

  await GuildTask.deleteOne({ _id: taskId });
  return interaction.update({ content: `🗑️ Aufgabe **${task.title}** wurde gelöscht.`, embeds: [], components: [] });
}

// ── Mitglieder-Ansicht ────────────────────────────────────────────────────────

async function handleAufgabenView(interaction) {
  const { guild, user } = interaction;
  const team = await GuildTeam.findOne({ guildId: guild.id, members: user.id });
  if (!team) return interaction.reply({ content: '❌ Du bist in keiner Gilde.', ephemeral: true });

  const tasks = await GuildTask.find({ teamId: team._id.toString() }).lean();
  if (!tasks.length) {
    return interaction.reply({ content: '❌ Diese Gilde hat noch keine Aufgaben ausgeschrieben.', ephemeral: true });
  }

  const myAssignments = tasks.filter(t => t.assignees?.some(a => a.userId === user.id));

  const available = tasks.filter(t => {
    const alreadyAssigned = t.assignees?.some(a => a.userId === user.id);
    const alreadyApplied  = t.applicants?.includes(user.id);
    const hasSlots        = (t.assignees?.length ?? 0) < t.slots;
    return !alreadyAssigned && !alreadyApplied && hasSlots;
  });

  const fields = [];

  if (myAssignments.length) {
    fields.push({
      name: '⚒️ Meine Aufgaben',
      value: myAssignments.map(t => {
        const assignee = t.assignees.find(a => a.userId === user.id);
        const statusLabel = assignee?.status === 'submitted' ? '*(eingereicht)*' : '';
        const typeLabel   = t.type === 'dauerhaft' ? `${formatCoins(t.reward)}/Woche` : formatCoins(t.reward);
        return `• **${t.title}** — ${typeLabel} ${statusLabel}`;
      }).join('\n'),
    });
  }

  const einmaligAvail  = available.filter(t => t.type === 'einmalig');
  const dauerhaftAvail = available.filter(t => t.type === 'dauerhaft');

  if (einmaligAvail.length) {
    fields.push({
      name: '📋 Offene Einmalaufgaben',
      value: einmaligAvail.map(t =>
        `• **${t.title}** — ${formatCoins(t.reward)}` + (t.description ? `\n  *${t.description}*` : '')
      ).join('\n'),
    });
  }

  if (dauerhaftAvail.length) {
    fields.push({
      name: '💼 Offene Dauerstellen',
      value: dauerhaftAvail.map(t =>
        `• **${t.title}** — ${formatCoins(t.reward)}/Woche · ${(t.assignees?.length ?? 0)}/${t.slots} belegt`
      ).join('\n'),
    });
  }

  // Tasks where user already applied
  const applied = tasks.filter(t => t.applicants?.includes(user.id) && !t.assignees?.some(a => a.userId === user.id));
  if (applied.length) {
    fields.push({
      name: '📬 Bewerbungen ausstehend',
      value: applied.map(t => `• **${t.title}**`).join('\n'),
    });
  }

  if (!fields.length) {
    fields.push({ name: 'Keine Aufgaben', value: '*Es gibt aktuell keine verfügbaren Aufgaben.*' });
  }

  const embed = createEmbed({
    title:  `📋 Aufgaben — ${team.name}`,
    color:  COLORS.PRIMARY,
    fields,
  });

  const components = [];
  if (available.length) {
    const options = available.slice(0, 25).map(t => ({
      label:       t.title.slice(0, 100),
      description: t.type === 'einmalig'
        ? `Einmalig · ${formatCoins(t.reward)}`
        : `Dauerhaft · ${formatCoins(t.reward)}/Woche`,
      value: t._id.toString(),
    }));
    components.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('aufgabe_apply_select')
          .setPlaceholder('Für eine Aufgabe bewerben…')
          .addOptions(options),
      ),
    );
  }

  return interaction.reply({ embeds: [embed], components, ephemeral: true });
}

async function handleAufgabeApplySelect(interaction) {
  const { guild, user } = interaction;
  const taskId = interaction.values[0];

  const task = await GuildTask.findById(taskId);
  if (!task) return interaction.update({ content: '❌ Aufgabe nicht gefunden.', components: [] });
  if (task.applicants?.includes(user.id)) return interaction.update({ content: '❌ Du hast dich bereits beworben.', components: [] });
  if (task.assignees?.some(a => a.userId === user.id)) return interaction.update({ content: '❌ Du bist bereits zugewiesen.', components: [] });
  if ((task.assignees?.length ?? 0) >= task.slots) return interaction.update({ content: '❌ Alle Plätze sind belegt.', components: [] });

  task.applicants.push(user.id);
  await task.save();
  return interaction.update({ content: `✅ Bewerbung für **${task.title}** eingereicht! Der Anführer prüft sie.`, components: [] });
}

// ── Einreichen & Genehmigung (einmalig) ───────────────────────────────────────

async function handleAufgabeSubmit(interaction) {
  const parts  = interaction.customId.split('_');
  const taskId = parts[2];
  const userId = parts[3];
  const { user } = interaction;

  if (user.id !== userId) {
    return interaction.reply({ content: '❌ Nur der zugewiesene Bearbeiter kann die Aufgabe einreichen.', ephemeral: true });
  }

  const task = await GuildTask.findById(taskId);
  if (!task) return interaction.reply({ content: '❌ Aufgabe nicht gefunden.', ephemeral: true });

  const assignee = task.assignees.find(a => a.userId === userId);
  if (!assignee || assignee.status !== 'active') {
    return interaction.reply({ content: '❌ Diese Aufgabe ist nicht aktiv oder bereits eingereicht.', ephemeral: true });
  }

  assignee.status      = 'submitted';
  assignee.submittedAt = new Date();
  await task.save();

  const embed = createEmbed({
    title:       '📬 Aufgabe eingereicht!',
    color:       COLORS.WARNING,
    description: `<@${userId}> hat die Aufgabe **${task.title}** als abgeschlossen markiert.\n\nBitte überprüfe die Arbeit und bestätige oder lehne ab.`,
    fields:      [{ name: 'Belohnung', value: formatCoins(task.reward), inline: true }],
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`aufgabe_approve_${taskId}_${userId}_${assignee.channelId}`)
      .setLabel('Annehmen')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`aufgabe_reject_${taskId}_${userId}_${assignee.channelId}`)
      .setLabel('Ablehnen')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger),
  );

  await interaction.update({ embeds: [embed], components: [row] });
}

async function handleAufgabeApprove(interaction) {
  const parts     = interaction.customId.split('_');
  const taskId    = parts[2];
  const userId    = parts[3];
  const channelId = parts[4];
  const { guild, user } = interaction;

  const task = await GuildTask.findById(taskId);
  if (!task) return interaction.reply({ content: '❌ Aufgabe nicht gefunden.', ephemeral: true });

  const team = await GuildTeam.findById(task.teamId);
  if (!team || team.leaderId !== user.id) {
    return interaction.reply({ content: '❌ Nur der Anführer kann Aufgaben genehmigen.', ephemeral: true });
  }

  const assignee = task.assignees.find(a => a.userId === userId);
  if (!assignee || assignee.status !== 'submitted') {
    return interaction.reply({ content: '❌ Diese Einreichung ist nicht mehr ausstehend.', ephemeral: true });
  }
  if (team.treasury < task.reward) {
    return interaction.reply({ content: `❌ Nicht genug in der Kasse! Verfügbar: **${formatCoins(team.treasury)}**`, ephemeral: true });
  }

  team.treasury -= task.reward;
  await team.save();

  await coinService.addCoins(guild.id, userId, task.reward, 'guild', `Aufgabe abgeschlossen: ${task.title}`);

  task.assignees = task.assignees.filter(a => a.userId !== userId);
  await task.save();

  const embed = createEmbed({
    title:       '✅ Aufgabe genehmigt!',
    color:       COLORS.SUCCESS,
    description: `<@${userId}> erhält **${formatCoins(task.reward)}** aus der Gildenkasse.\n\nDieser Channel wird in 10 Sekunden gelöscht.`,
  });
  await interaction.update({ embeds: [embed], components: [] });

  setTimeout(async () => {
    const ch = await guild.channels.fetch(channelId).catch(() => null);
    if (ch) await ch.delete().catch(() => {});
  }, 10_000);
}

async function handleAufgabeReject(interaction) {
  const parts     = interaction.customId.split('_');
  const taskId    = parts[2];
  const userId    = parts[3];
  const channelId = parts[4];
  const { guild, user } = interaction;

  const task = await GuildTask.findById(taskId);
  if (!task) return interaction.reply({ content: '❌ Aufgabe nicht gefunden.', ephemeral: true });

  const team = await GuildTeam.findById(task.teamId).lean();
  if (!team || team.leaderId !== user.id) {
    return interaction.reply({ content: '❌ Nur der Anführer kann Aufgaben ablehnen.', ephemeral: true });
  }

  const assignee = task.assignees.find(a => a.userId === userId);
  if (!assignee || assignee.status !== 'submitted') {
    return interaction.reply({ content: '❌ Diese Einreichung ist nicht mehr ausstehend.', ephemeral: true });
  }

  task.assignees = task.assignees.filter(a => a.userId !== userId);
  await task.save();

  sendDmNotification(
    interaction.client,
    guild.id,
    userId,
    `❌ Deine eingereichte Aufgabe **${task.title}** wurde abgelehnt.`,
  );

  const embed = createEmbed({
    title:       '❌ Aufgabe abgelehnt',
    color:       COLORS.ERROR,
    description: 'Die Einreichung wurde abgelehnt.\n\nDieser Channel wird in 10 Sekunden gelöscht.',
  });
  await interaction.update({ embeds: [embed], components: [] });

  setTimeout(async () => {
    const ch = await guild.channels.fetch(channelId).catch(() => null);
    if (ch) await ch.delete().catch(() => {});
  }, 10_000);
}

// ── Wochenbeitrag (Anführer) ──────────────────────────────────────────────────

function showSetContributionModal(interaction) {
  const modal = new ModalBuilder().setCustomId('modal_guild_job_beitrag').setTitle('Wochenbeitrag festlegen');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('amount').setLabel('Betrag pro Mitglied pro Woche').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('z.B. 500'),
    ),
  );
  return interaction.showModal(modal);
}

async function handleSetContribution(interaction) {
  const { guild, user } = interaction;
  const amount = parseInt(interaction.fields.getTextInputValue('amount'));
  if (isNaN(amount) || amount < 0) return interaction.reply({ content: '❌ Ungültiger Betrag.', ephemeral: true });

  const team = await GuildTeam.findOne({ guildId: guild.id, leaderId: user.id });
  if (!team) return interaction.reply({ content: '❌ Nur der Anführer kann den Beitrag festlegen.', ephemeral: true });

  team.weeklyContribution = amount;
  await team.save();
  return interaction.reply({ content: `✅ Wochenbeitrag auf **${formatCoins(amount)}** pro Mitglied gesetzt.`, ephemeral: true });
}

module.exports = {
  getGildenPayload,
  handleGildenButton,
  handleGildenViewDetail,
  handleManageView,
  handleRangliste,
  createGuildChannels,
  handleCreate,
  handleDonate,
  handleInvite,
  showKickSelect,
  handleKickSelect,
  handleLeave,
  handleLeaveExecute,
  handleDisbandConfirm,
  handleDisbandExecute,
  showCreateModal,
  showDonateModal,
  showInviteModal,
  showManifestModal,
  handleManifest,
  handleJoin,
  handleJoinSelect,
  handleJoinClaimConfirm,
  handleAnfragenAnnehmen,
  handleAnfragenAnnehmenSelect,
  handleAnfragenAblehnen,
  handleAnfragenAblehnenSelect,
  handleNewsView,
  handleNewsPage,
  showNewsAddModal,
  handleNewsAdd,
  handleClaimLeadership,
  showRoleColorModal,
  handleRoleColor,
  handlePersonalView,
  handlePersonalErnennen,
  handlePersonalErnennenSelect,
  handlePersonalEntlassen,
  handlePersonalEntlassenSelect,
  handleAufgabenManage,
  showCreateAufgabeModal,
  handleCreateAufgabe,
  showAufgabeApplicationsSelect,
  handleAufgabeApplicationsSelect,
  handleAufgabeApplicantSelect,
  showAufgabeDeleteSelect,
  handleAufgabeDeleteSelect,
  handleAufgabenView,
  handleAufgabeApplySelect,
  handleAufgabeSubmit,
  handleAufgabeApprove,
  handleAufgabeReject,
  showSetContributionModal,
  handleSetContribution,
};
