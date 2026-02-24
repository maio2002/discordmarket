const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const GuildTeam = require('../models/GuildTeam');
const coinService = require('./coinService');
const { createEmbed, COLORS } = require('../utils/embedBuilder');
const { formatCoins, formatNumber } = require('../utils/formatters');
const { GUILD } = require('../constants');

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

  return { embeds: [embed], components: [row] };
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
  await GuildTeam.deleteOne({ _id: team._id });
  return interaction.update({ content: `💀 Die Gilde **${team.name}** wurde aufgelöst.`, embeds: [], components: [] });
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

  const team = await GuildTeam.create({ guildId: guild.id, name, leaderId: user.id, members: [user.id], description });
  const payload = buildGildenEmbed(team);
  return interaction.reply({ ...payload, content: `✅ Gilde **${name}** gegründet!`, ephemeral: true });
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

  const payload = buildGildenEmbed(team);
  return interaction.reply({ ...payload, content: `✅ <@${raw}> wurde entfernt.`, ephemeral: true });
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
};
