const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  ChannelType, OverwriteType, PermissionFlagsBits,
} = require('discord.js');
const GuildTeam = require('../models/GuildTeam');
const coinService = require('./coinService');
const { createEmbed, COLORS } = require('../utils/embedBuilder');
const { formatCoins, formatNumber } = require('../utils/formatters');
const { GUILD } = require('../constants');
const logger = require('../utils/logger');

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

function buildGildenEmbed(team) {
  const levelName = GUILD.LEVELS[team.level]?.name ?? 'Unbekannt';
  const d = new Date(team.foundedAt);
  const founded = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;

  const fields = [
    { name: 'Anführer', value: `<@${team.leaderId}>`, inline: true },
    { name: 'Mitglieder', value: `${team.members.length}`, inline: true },
    { name: 'Kasse', value: formatCoins(team.treasury), inline: true },
  ];

  if (team.members.length <= 20) {
    fields.push({ name: 'Mitgliedsliste', value: team.members.map(id => `<@${id}>`).join(' ') || '—' });
  }

  const bar = buildProgressBar(team.treasury);
  if (bar) fields.push({ name: 'Nächste Stufe', value: bar });

  const embed = createEmbed({
    title: `⚔️ ${team.name} — Stufe ${team.level} (${levelName})`,
    color: levelColor(team.level),
    description: team.description ? `*${team.description}*` : null,
    fields,
    footer: `Gegründet am ${founded}`,
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('gilden_donate').setLabel('Spenden').setEmoji('💰').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('gilden_invite').setLabel('Einladen').setEmoji('➕').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('gilden_kick').setLabel('Kick').setEmoji('🚪').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('gilden_leave').setLabel('Verlassen').setEmoji('🚶').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('gilden_disband').setLabel('Auflösen').setEmoji('💀').setStyle(ButtonStyle.Danger),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('gilden_manifest').setLabel('Manifest bearbeiten').setEmoji('📜').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row, row2] };
}

function buildNoGildePayload() {
  const embed = createEmbed({
    title: '⚔️ Gilden',
    color: COLORS.PRIMARY,
    description: `Du bist noch in keiner Gilde.\n\nGründe deine eigene für **${formatCoins(GUILD.FOUND_COST)}**!`,
  });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('gilden_create').setLabel('Gilde gründen').setEmoji('⚔️').setStyle(ButtonStyle.Success),
  );
  return { embeds: [embed], components: [row] };
}

async function getGildenPayload(guildId, userId) {
  const team = await GuildTeam.findOne({ guildId, members: userId });
  if (!team) return buildNoGildePayload();
  return buildGildenEmbed(team);
}

// ─── Kanal-Verwaltung ────────────────────────────────────────────────────────

function buildGuildOverwrites(discordGuild, team) {
  return [
    { id: discordGuild.id, type: OverwriteType.Role, deny: [PermissionFlagsBits.ViewChannel] },
    ...team.members.map(id => ({ id, type: OverwriteType.Member, allow: [PermissionFlagsBits.ViewChannel] })),
  ];
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

  const chatOptions = {
    name: `💬︱${team.name.toLowerCase().replace(/\s+/g, '-')}`,
    type: ChannelType.GuildText,
    permissionOverwrites: overwrites,
  };
  if (chatMarker.parent) chatOptions.parent = chatMarker.parent;

  const voiceOptions = {
    name: `🔊 ${team.name}`,
    type: ChannelType.GuildVoice,
    permissionOverwrites: overwrites,
  };
  if (voiceMarker.parent) voiceOptions.parent = voiceMarker.parent;

  const chat = await discordGuild.channels.create(chatOptions);
  const voice = await discordGuild.channels.create(voiceOptions);

  if (chatMarker.position !== null) {
    await chat.setPosition(chatMarker.position + 1, { relative: false }).catch(() => {});
  }
  if (voiceMarker.position !== null) {
    await voice.setPosition(voiceMarker.position + 1, { relative: false }).catch(() => {});
  }

  return { categoryId: null, chatId: chat.id, newsId: null, voiceId: voice.id };
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

async function handleLeave(interaction) {
  const { guild, user } = interaction;
  const team = await GuildTeam.findOne({ guildId: guild.id, members: user.id });
  if (!team) return interaction.reply({ content: '❌ Du bist in keiner Gilde.', ephemeral: true });
  if (team.leaderId === user.id) {
    return interaction.reply({ content: '❌ Als Anführer kannst du nicht verlassen — löse die Gilde auf oder gib sie ab.', ephemeral: true });
  }
  team.members = team.members.filter(id => id !== user.id);
  await team.save();
  syncGuildChannelPerms(guild, team).catch(() => {});
  return interaction.reply({ content: `✅ Du hast die Gilde **${team.name}** verlassen.`, ephemeral: true });
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

function showDonateModal(interaction) {
  const modal = new ModalBuilder().setCustomId('modal_gilden_donate').setTitle('In Kasse einzahlen');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('amount').setLabel('Betrag').setStyle(TextInputStyle.Short).setPlaceholder('z.B. 500').setRequired(true),
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

function showKickModal(interaction) {
  const modal = new ModalBuilder().setCustomId('modal_gilden_kick').setTitle('Mitglied entfernen');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('userId').setLabel('Discord-ID oder @Mention').setStyle(TextInputStyle.Short).setPlaceholder('z.B. 123456789012345678').setRequired(true),
    ),
  );
  return interaction.showModal(modal);
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

  try {
    const channelIds = await createGuildChannels(guild, team);
    team.channels = channelIds;
    await team.save();
  } catch (err) {
    logger.warn(`Gilden-Kanäle für "${name}" konnten nicht erstellt werden: ${err.message}`);
  }

  const payload = buildGildenEmbed(team);
  return interaction.editReply({ ...payload, content: `✅ Gilde **${name}** gegründet!` });
}

async function handleDonate(interaction) {
  const { guild, user } = interaction;
  const amount = parseInt(interaction.fields.getTextInputValue('amount').replace(/\D/g, ''), 10);
  if (!amount || amount <= 0) return interaction.reply({ content: '❌ Ungültiger Betrag.', ephemeral: true });

  const team = await GuildTeam.findOne({ guildId: guild.id, members: user.id });
  if (!team) return interaction.reply({ content: '❌ Du bist in keiner Gilde.', ephemeral: true });

  try {
    await coinService.removeCoins(guild.id, user.id, amount, 'guild', `Gildenspende: ${team.name}`);
  } catch (err) {
    return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
  }

  team.treasury += amount;
  team.level = calcLevel(team.treasury);
  await team.save();

  const payload = buildGildenEmbed(team);
  return interaction.reply({ ...payload, content: `✅ <@${user.id}> hat **${formatCoins(amount)}** in die Kasse eingezahlt!`, ephemeral: true });
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
  syncGuildChannelPerms(guild, team).catch(() => {});

  const payload = buildGildenEmbed(team);
  return interaction.reply({ ...payload, content: `✅ <@${target.id}> wurde eingeladen!`, ephemeral: true });
}

async function handleKick(interaction) {
  const { guild, user } = interaction;
  const raw = interaction.fields.getTextInputValue('userId').trim().replace(/[<@!>]/g, '');

  const team = await GuildTeam.findOne({ guildId: guild.id, leaderId: user.id });
  if (!team) return interaction.reply({ content: '❌ Nur der Anführer kann Mitglieder entfernen.', ephemeral: true });
  if (raw === user.id) return interaction.reply({ content: '❌ Du kannst dich nicht selbst kicken.', ephemeral: true });
  if (!team.members.includes(raw)) return interaction.reply({ content: '❌ Kein Mitglied dieser Gilde.', ephemeral: true });

  team.members = team.members.filter(id => id !== raw);
  await team.save();
  syncGuildChannelPerms(guild, team).catch(() => {});

  const payload = buildGildenEmbed(team);
  return interaction.reply({ ...payload, content: `✅ <@${raw}> wurde entfernt.`, ephemeral: true });
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

module.exports = {
  getGildenPayload,
  handleGildenButton,
  handleCreate,
  handleDonate,
  handleInvite,
  handleKick,
  handleLeave,
  handleDisbandConfirm,
  handleDisbandExecute,
  showCreateModal,
  showDonateModal,
  showInviteModal,
  showKickModal,
  showManifestModal,
  handleManifest,
};
