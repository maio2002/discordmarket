const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionFlagsBits,
  OverwriteType,
} = require('discord.js');

const Arena    = require('../models/Arena');
const GuildTeam = require('../models/GuildTeam');
const coinService = require('./coinService');
const xpService   = require('./xpService');
const { createEmbed, COLORS } = require('../utils/embedBuilder');
const { formatCoins, formatTimestamp } = require('../utils/formatters');
const { ARENA } = require('../constants');
const logger = require('../utils/logger');

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function statusLabel(status) {
  return { offen: '🟢 Offen', aktiv: '⚔️ Aktiv', abstimmung: '🗳️ Abstimmung', beendet: '🏆 Beendet' }[status] ?? status;
}

function statusColor(status) {
  return { offen: COLORS.SUCCESS, aktiv: COLORS.WARNING, abstimmung: COLORS.XP, beendet: COLORS.GOLD }[status] ?? COLORS.PRIMARY;
}

async function isEligibleCreator(guildId, userId, member) {
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  const team = await GuildTeam.findOne({ guildId, leaderId: userId });
  return !!team;
}

// ─── Hauptmenü ───────────────────────────────────────────────────────────────

async function getArenaOverviewPayload(guildId, userId, member) {
  const [aktive, abstimmung, beendet] = await Promise.all([
    Arena.countDocuments({ guildId, status: { $in: ['offen', 'aktiv'] } }),
    Arena.countDocuments({ guildId, status: 'abstimmung' }),
    Arena.countDocuments({ guildId, status: 'beendet' }),
  ]);

  const embed = createEmbed({
    title:       '⚔️ Arena — Debatten & Gildenkämpfe',
    color:       COLORS.PRIMARY,
    description:
      'Organisiere öffentliche Debatten, zahle in den Preispool ein und stimme für den Sieger ab.\n' +
      'Bei Gildenkämpfen setzt jede Gilde einen Teil ihrer Kasse als Wetteinsatz.',
    fields: [
      { name: '🟢 Aktive Arenen',     value: `${aktive}`,     inline: true },
      { name: '🗳️ In Abstimmung',    value: `${abstimmung}`, inline: true },
      { name: '🏆 Abgeschlossen',     value: `${beendet}`,    inline: true },
    ],
  });

  const eligible = await isEligibleCreator(guildId, userId, member);

  const row = new ActionRowBuilder().addComponents(
    ...(eligible
      ? [new ButtonBuilder().setCustomId('arena_erstellen').setLabel('Erstellen').setEmoji('🗡️').setStyle(ButtonStyle.Success)]
      : []),
    new ButtonBuilder().setCustomId('arena_page_' + guildId + '_0').setLabel('Arenen ansehen').setEmoji('📋').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('gilden_alle_view').setLabel('Alle Gilden').setEmoji('🏰').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row] };
}

// ─── Arena-Detailansicht (paginiert) ─────────────────────────────────────────

async function buildArenaDetailPayload(guildId, page, userId) {
  const arenas = await Arena.find({ guildId }).sort({ createdAt: -1 }).lean();
  if (!arenas.length) {
    return { content: '❌ Noch keine Arenen auf diesem Server.', embeds: [], components: [] };
  }

  const total = arenas.length;
  const p     = Math.max(0, Math.min(page, total - 1));
  const a     = arenas[p];

  // Teilnehmer-Info
  let teilnehmer;
  if (a.type === 'einzeln') {
    teilnehmer = a.debaters.length
      ? a.debaters.map(d => `<@${d.userId}>`).join(', ')
      : '*Noch keine Debattanten*';
  } else {
    teilnehmer = a.guilds.length
      ? a.guilds.map(g => `**${g.name}** (${formatCoins(g.wager)} Einsatz)`).join('\n')
      : '*Noch keine Gilden angemeldet*';
  }

  const embed = createEmbed({
    title:       `${statusLabel(a.status)} — ${a.topic}`,
    color:       statusColor(a.status),
    description: a.description ?? undefined,
    fields: [
      { name: '📋 Typ',          value: a.type === 'einzeln' ? 'Einzeldebatte' : 'Gildenkampf', inline: true },
      { name: '💰 Preispool',    value: formatCoins(a.prizePool),                                inline: true },
      { name: '👥 Teilnehmer',   value: teilnehmer,                                              inline: false },
      { name: '📅 Debatte ab',   value: formatTimestamp(a.activeAt),                             inline: true },
      { name: '🗳️ Wahl ab',     value: formatTimestamp(a.voteAt),                               inline: true },
      { name: '🏁 Ende',         value: formatTimestamp(a.endsAt),                               inline: true },
    ],
    footer: `Arena ${p + 1} / ${total}`,
  });

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(p > 0 ? `arena_page_${guildId}_${p - 1}` : 'arena_noop1')
      .setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
    new ButtonBuilder()
      .setCustomId(p < total - 1 ? `arena_page_${guildId}_${p + 1}` : 'arena_noop2')
      .setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(p === total - 1),
  );

  const components = [navRow];

  // Aktions-Buttons je nach Status
  if (a.status === 'offen') {
    const actionBtns = [
      new ButtonBuilder().setCustomId(`arena_anmelden_${a._id}`).setLabel('Anmelden').setEmoji('✋').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`arena_einzahlen_${a._id}`).setLabel('Einzahlen').setEmoji('💰').setStyle(ButtonStyle.Success),
    ];
    if (a.type === 'gilde') {
      actionBtns.push(
        new ButtonBuilder().setCustomId(`arena_gilde_anmelden_${a._id}`).setLabel('Gilde anmelden').setEmoji('⚔️').setStyle(ButtonStyle.Primary),
      );
    }
    components.push(new ActionRowBuilder().addComponents(actionBtns));
  }

  if (a.status === 'abstimmung') {
    components.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`arena_abstimmen_${a._id}`).setLabel('Abstimmen').setEmoji('🗳️').setStyle(ButtonStyle.Primary),
    ));
  }

  return { embeds: [embed], components };
}

// ─── Navigation ──────────────────────────────────────────────────────────────

async function handleArenaPage(interaction) {
  const page        = parseInt(interaction.customId.split('_').at(-1), 10);
  const guildId     = interaction.customId.slice('arena_page_'.length, interaction.customId.lastIndexOf('_'));
  const payload     = await buildArenaDetailPayload(guildId, page, interaction.user.id);
  return interaction.update(payload);
}

// ─── Arena erstellen ─────────────────────────────────────────────────────────

async function showCreateArenaModal(interaction) {
  const eligible = await isEligibleCreator(interaction.guild.id, interaction.user.id, interaction.member);
  if (!eligible) return interaction.reply({ content: '❌ Du hast keine Berechtigung, Arenen zu erstellen.', ephemeral: true });

  const modal = new ModalBuilder().setCustomId('modal_arena_erstellen').setTitle('Arena erstellen');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('topic').setLabel('Thema / Debattenfrage').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('description').setLabel('Beschreibung / Kontext (optional)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500),
    ),
  );
  return interaction.showModal(modal);
}

async function handleCreateArena(interaction) {
  const eligible = await isEligibleCreator(interaction.guild.id, interaction.user.id, interaction.member);
  if (!eligible) return interaction.reply({ content: '❌ Keine Berechtigung.', ephemeral: true });

  const topic       = interaction.fields.getTextInputValue('topic').trim();
  const description = interaction.fields.getTextInputValue('description').trim() || null;

  // Zwischenspeicher: topic+description im customId der Antwort für den nächsten Schritt
  const encoded = encodeURIComponent(JSON.stringify({ topic, description }));

  const select = new StringSelectMenuBuilder()
    .setCustomId(`arena_type_select_${encoded}`)
    .setPlaceholder('Arena-Typ wählen')
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('Einzeldebatte').setValue('einzeln').setDescription('Einzelne Nutzer treten gegeneinander an').setEmoji('🎤'),
      new StringSelectMenuOptionBuilder().setLabel('Gildenkampf').setValue('gilde').setDescription('Zwei Gilden kämpfen gegeneinander').setEmoji('⚔️'),
    );

  return interaction.reply({
    embeds: [createEmbed({ title: '⚔️ Arena erstellen', color: COLORS.PRIMARY, description: `**Thema:** ${topic}\n\nWelcher Typ soll die Arena haben?` })],
    components: [new ActionRowBuilder().addComponents(select)],
    ephemeral: true,
  });
}

async function handleArenaTypeSelect(interaction) {
  const parts   = interaction.customId.split('arena_type_select_');
  const encoded = parts[1];
  let meta;
  try { meta = JSON.parse(decodeURIComponent(encoded)); } catch { return interaction.reply({ content: '❌ Interner Fehler.', ephemeral: true }); }

  const type = interaction.values[0];
  await showArenaDauerModal(interaction, type, meta);
}

async function showArenaDauerModal(interaction, type, meta) {
  const modal = new ModalBuilder()
    .setCustomId(`modal_arena_dauer_${type}_${encodeURIComponent(JSON.stringify(meta))}`)
    .setTitle('Phasen-Dauer festlegen');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('open_min').setLabel('Anmeldephase (Minuten, 5–1440)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('60'),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('debate_min').setLabel('Debatte (Minuten, 5–1440)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('60'),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('vote_min').setLabel('Abstimmung (Minuten, 5–1440)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('30'),
    ),
  );
  return interaction.showModal(modal);
}

async function handleArenaDauerModal(interaction) {
  // customId: modal_arena_dauer_{type}_{encodedMeta}
  const withoutPrefix = interaction.customId.slice('modal_arena_dauer_'.length);
  const typeEnd        = withoutPrefix.indexOf('_');
  const type           = withoutPrefix.slice(0, typeEnd);
  const encoded        = withoutPrefix.slice(typeEnd + 1);

  let meta;
  try { meta = JSON.parse(decodeURIComponent(encoded)); } catch { return interaction.reply({ content: '❌ Interner Fehler.', ephemeral: true }); }

  const parse = (key) => {
    const v = parseInt(interaction.fields.getTextInputValue(key), 10);
    return isNaN(v) ? null : Math.max(ARENA.MIN_OPEN_MINUTES, Math.min(ARENA.MAX_OPEN_MINUTES, v));
  };
  const openMin   = parse('open_min');
  const debateMin = parse('debate_min');
  const voteMin   = parse('vote_min');

  if (!openMin || !debateMin || !voteMin) {
    return interaction.reply({ content: '❌ Bitte gültige Zahlen eingeben (5–1440 Minuten).', ephemeral: true });
  }

  const now      = new Date();
  const activeAt = new Date(now.getTime() + openMin   * 60_000);
  const voteAt   = new Date(activeAt.getTime() + debateMin * 60_000);
  const endsAt   = new Date(voteAt.getTime()   + voteMin  * 60_000);

  const arena = await Arena.create({
    guildId:     interaction.guild.id,
    creatorId:   interaction.user.id,
    topic:       meta.topic,
    description: meta.description,
    type,
    activeAt,
    voteAt,
    endsAt,
  });

  const embed = createEmbed({
    title:       '✅ Arena erstellt!',
    color:       COLORS.SUCCESS,
    description: `**${meta.topic}**`,
    fields: [
      { name: '📋 Typ',        value: type === 'einzeln' ? 'Einzeldebatte' : 'Gildenkampf', inline: true },
      { name: '📅 Debatte ab', value: formatTimestamp(activeAt),                            inline: true },
      { name: '🗳️ Wahl ab',   value: formatTimestamp(voteAt),                              inline: true },
      { name: '🏁 Ende',       value: formatTimestamp(endsAt),                              inline: true },
    ],
  });

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

// ─── Anmelden (Einzeldebattant) ───────────────────────────────────────────────

async function handleArenaAnmelden(interaction) {
  const arenaId = interaction.customId.replace('arena_anmelden_', '');
  const arena   = await Arena.findById(arenaId);

  if (!arena || arena.guildId !== interaction.guild.id) return interaction.reply({ content: '❌ Arena nicht gefunden.', ephemeral: true });
  if (arena.type !== 'einzeln') return interaction.reply({ content: '❌ Das ist ein Gildenkampf.', ephemeral: true });
  if (arena.status !== 'offen') return interaction.reply({ content: '❌ Die Anmeldephase ist beendet.', ephemeral: true });
  if (arena.debaters.some(d => d.userId === interaction.user.id)) return interaction.reply({ content: '❌ Du bist bereits angemeldet.', ephemeral: true });
  if (arena.debaters.length >= ARENA.MAX_DEBATERS) return interaction.reply({ content: `❌ Maximum von ${ARENA.MAX_DEBATERS} Debattanten erreicht.`, ephemeral: true });

  arena.debaters.push({ userId: interaction.user.id });
  await arena.save();

  return interaction.reply({ content: '✅ Du bist als Debattant angemeldet!', ephemeral: true });
}

// ─── Gilde anmelden ──────────────────────────────────────────────────────────

async function handleArenaGildeAnmelden(interaction) {
  const arenaId = interaction.customId.replace('arena_gilde_anmelden_', '');
  const arena   = await Arena.findById(arenaId);

  if (!arena || arena.guildId !== interaction.guild.id) return interaction.reply({ content: '❌ Arena nicht gefunden.', ephemeral: true });
  if (arena.type !== 'gilde') return interaction.reply({ content: '❌ Das ist keine Gildenkampf-Arena.', ephemeral: true });
  if (arena.status !== 'offen') return interaction.reply({ content: '❌ Die Anmeldephase ist beendet.', ephemeral: true });
  if (arena.guilds.length >= 2) return interaction.reply({ content: '❌ Es sind bereits zwei Gilden angemeldet.', ephemeral: true });

  const team = await GuildTeam.findOne({ guildId: interaction.guild.id, leaderId: interaction.user.id });
  if (!team) return interaction.reply({ content: '❌ Du bist kein Gildenleiter.', ephemeral: true });
  if (arena.guilds.some(g => g.teamId === team._id.toString())) return interaction.reply({ content: '❌ Deine Gilde ist bereits angemeldet.', ephemeral: true });

  const modal = new ModalBuilder()
    .setCustomId(`modal_arena_wager_${arenaId}_${team._id}`)
    .setTitle(`Gilde ${team.name} anmelden`);
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('wager')
        .setLabel(`Wetteinsatz aus der Gildenkasse (min. ${ARENA.MIN_WAGER})`)
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder(`${ARENA.MIN_WAGER}`),
    ),
  );
  return interaction.showModal(modal);
}

async function handleArenaWager(interaction) {
  // customId: modal_arena_wager_{arenaId}_{teamId}
  const parts   = interaction.customId.replace('modal_arena_wager_', '').split('_');
  const teamId  = parts.at(-1);
  const arenaId = parts.slice(0, -1).join('_');

  const [arena, team] = await Promise.all([
    Arena.findById(arenaId),
    GuildTeam.findById(teamId),
  ]);

  if (!arena || !team) return interaction.reply({ content: '❌ Nicht gefunden.', ephemeral: true });
  if (arena.status !== 'offen') return interaction.reply({ content: '❌ Anmeldephase beendet.', ephemeral: true });
  if (arena.guilds.length >= 2) return interaction.reply({ content: '❌ Bereits zwei Gilden angemeldet.', ephemeral: true });

  const wager = parseInt(interaction.fields.getTextInputValue('wager'), 10);
  if (isNaN(wager) || wager < ARENA.MIN_WAGER) return interaction.reply({ content: `❌ Mindest-Einsatz: ${formatCoins(ARENA.MIN_WAGER)}.`, ephemeral: true });
  if (team.treasury < wager) return interaction.reply({ content: `❌ Nicht genug in der Gildenkasse. Vorhanden: ${formatCoins(team.treasury)}.`, ephemeral: true });

  team.treasury -= wager;
  arena.guilds.push({ teamId: team._id.toString(), name: team.name, wager });
  arena.prizePool += wager;

  await Promise.all([team.save(), arena.save()]);

  return interaction.reply({ content: `✅ **${team.name}** ist angemeldet mit einem Einsatz von **${formatCoins(wager)}**.`, ephemeral: true });
}

// ─── Einzahlen ────────────────────────────────────────────────────────────────

async function showArenaEinzahlenModal(interaction) {
  const arenaId = interaction.customId.replace('arena_einzahlen_', '');
  const modal   = new ModalBuilder()
    .setCustomId(`modal_arena_einzahlen_${arenaId}`)
    .setTitle('In Preispool einzahlen');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('betrag')
        .setLabel(`Betrag (min. ${ARENA.MIN_CONTRIBUTION} Coins)`)
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder(`${ARENA.MIN_CONTRIBUTION}`),
    ),
  );
  return interaction.showModal(modal);
}

async function handleArenaEinzahlen(interaction) {
  const arenaId = interaction.customId.replace('modal_arena_einzahlen_', '');
  const arena   = await Arena.findById(arenaId);

  if (!arena || arena.guildId !== interaction.guild.id) return interaction.reply({ content: '❌ Arena nicht gefunden.', ephemeral: true });
  if (arena.status !== 'offen') return interaction.reply({ content: '❌ Einzahlungen sind nur in der Anmeldephase möglich.', ephemeral: true });

  const betrag = parseInt(interaction.fields.getTextInputValue('betrag'), 10);
  if (isNaN(betrag) || betrag < ARENA.MIN_CONTRIBUTION) return interaction.reply({ content: `❌ Mindestbetrag: ${formatCoins(ARENA.MIN_CONTRIBUTION)}.`, ephemeral: true });

  try {
    await coinService.removeCoins(interaction.guild.id, interaction.user.id, betrag, 'arena', `Einzahlung Arena: ${arena.topic}`);
  } catch (err) {
    return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
  }

  const prev = arena.contributions.get(interaction.user.id) ?? 0;
  arena.contributions.set(interaction.user.id, prev + betrag);
  arena.prizePool += betrag;
  await arena.save();

  return interaction.reply({ content: `✅ Du hast **${formatCoins(betrag)}** in den Preispool eingezahlt. Gesamt: **${formatCoins(arena.prizePool)}**.`, ephemeral: true });
}

// ─── Abstimmen ────────────────────────────────────────────────────────────────

async function handleArenaAbstimmen(interaction) {
  const arenaId = interaction.customId.replace('arena_abstimmen_', '');
  const arena   = await Arena.findById(arenaId);

  if (!arena || arena.guildId !== interaction.guild.id) return interaction.reply({ content: '❌ Arena nicht gefunden.', ephemeral: true });
  if (arena.status !== 'abstimmung') return interaction.reply({ content: '❌ Die Abstimmungsphase hat noch nicht begonnen.', ephemeral: true });

  const options = arena.type === 'einzeln'
    ? arena.debaters.map(d => new StringSelectMenuOptionBuilder().setLabel(`Debattant: ${d.userId}`).setValue(d.userId))
    : arena.guilds.map(g => new StringSelectMenuOptionBuilder().setLabel(g.name).setValue(g.teamId).setDescription(`Einsatz: ${formatCoins(g.wager)}`));

  if (!options.length) return interaction.reply({ content: '❌ Keine Teilnehmer vorhanden.', ephemeral: true });

  const currentVote = arena.votes.get(interaction.user.id);
  const select = new StringSelectMenuBuilder()
    .setCustomId(`arena_abstimmung_select_${arenaId}`)
    .setPlaceholder(currentVote ? `Aktuell: ${currentVote}` : 'Kandidaten wählen')
    .addOptions(options);

  return interaction.reply({
    embeds: [createEmbed({ title: '🗳️ Abstimmung', color: COLORS.XP, description: `**${arena.topic}**\n\nDein Stimmgewicht hängt von deinem Level ab (Level + 1).` })],
    components: [new ActionRowBuilder().addComponents(select)],
    ephemeral: true,
  });
}

async function handleArenaAbstimmungSelect(interaction) {
  const arenaId  = interaction.customId.replace('arena_abstimmung_select_', '');
  const targetId = interaction.values[0];
  const arena    = await Arena.findById(arenaId);

  if (!arena || arena.status !== 'abstimmung') return interaction.reply({ content: '❌ Abstimmung nicht mehr aktiv.', ephemeral: true });

  // Validieren: targetId ist ein gültiger Teilnehmer
  const valid = arena.type === 'einzeln'
    ? arena.debaters.some(d => d.userId === targetId)
    : arena.guilds.some(g => g.teamId === targetId);
  if (!valid) return interaction.reply({ content: '❌ Ungültige Auswahl.', ephemeral: true });

  arena.votes.set(interaction.user.id, targetId);
  await arena.save();

  return interaction.update({ content: `✅ Deine Stimme wurde gezählt.`, embeds: [], components: [] });
}

// ─── Cron: Phasen-Übergänge ──────────────────────────────────────────────────

async function processArenaTransitions(client) {
  const now    = new Date();
  const arenas = await Arena.find({ status: { $ne: 'beendet' } });

  for (const arena of arenas) {
    try {
      if (arena.status === 'offen' && now >= arena.activeAt) {
        arena.status = 'aktiv';
        await arena.save();
        await createDebateChannel(arena, client);
        logger.info(`Arena ${arena._id} → aktiv`);

      } else if (arena.status === 'aktiv' && now >= arena.voteAt) {
        arena.status = 'abstimmung';
        await arena.save();
        logger.info(`Arena ${arena._id} → abstimmung`);

      } else if (arena.status === 'abstimmung' && now >= arena.endsAt) {
        await distributeArenaPrizes(arena, client);
        logger.info(`Arena ${arena._id} → beendet`);
      }
    } catch (err) {
      logger.error(`Arena-Übergang ${arena._id} fehlgeschlagen: ${err.message}`);
    }
  }
}

// ─── Debattenkanal erstellen ─────────────────────────────────────────────────

async function createDebateChannel(arena, client) {
  const GuildConfig = require('../models/GuildConfig');
  const discordGuild = client.guilds.cache.get(arena.guildId);
  if (!discordGuild) return;

  const config = await GuildConfig.findOne({ guildId: arena.guildId });

  const debaterIds = arena.type === 'einzeln'
    ? arena.debaters.map(d => d.userId)
    : [];  // Für Gilden: keine individuellen Kanal-Permissions

  const overwrites = [
    { id: discordGuild.id, type: OverwriteType.Role, deny: [PermissionFlagsBits.ViewChannel] },
    // Alle können zuschauen (nur lesen)
    { id: discordGuild.id, type: OverwriteType.Role, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
  ];

  // Debattanten dürfen schreiben
  for (const userId of debaterIds) {
    overwrites.push({
      id:    userId,
      type:  OverwriteType.Member,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    });
  }

  let parent = null;
  if (config?.gildenChatMarkerChannelId) {
    const marker = await discordGuild.channels.fetch(config.gildenChatMarkerChannelId).catch(() => null);
    if (marker) parent = marker.parentId;
  }

  const channelOptions = {
    name: `⚔️︱${arena.topic.slice(0, 40).toLowerCase().replace(/\s+/g, '-')}`,
    type: ChannelType.GuildText,
    permissionOverwrites: overwrites,
  };
  if (parent) channelOptions.parent = parent;

  const channel = await discordGuild.channels.create(channelOptions).catch(() => null);
  if (channel) {
    arena.channelId = channel.id;
    await arena.save();
    await channel.send({
      embeds: [createEmbed({
        title:       `⚔️ ${arena.topic}`,
        color:       COLORS.WARNING,
        description: (arena.description ?? '') + '\n\nDie Debatte beginnt jetzt! Abstimmung startet ' + formatTimestamp(arena.voteAt) + '.',
      })],
    });
  }
}

// ─── Preise verteilen ────────────────────────────────────────────────────────

async function distributeArenaPrizes(arena, client) {
  const discordGuild = client.guilds.cache.get(arena.guildId);

  // Stimmgewichte berechnen (weight = voter.level + 1)
  const voteMap = new Map(); // debaterId → totalWeight

  for (const [voterId, debaterId] of arena.votes.entries()) {
    const user = await xpService.getOrCreateUser(arena.guildId, voterId).catch(() => null);
    const weight = user ? (user.level + 1) : 1;
    voteMap.set(debaterId, (voteMap.get(debaterId) ?? 0) + weight);
  }

  const totalWeight = [...voteMap.values()].reduce((a, b) => a + b, 0);
  const results     = [];

  if (totalWeight === 0 || arena.prizePool === 0) {
    // Keine Stimmen: Rückerstattung an Einzahler
    for (const [userId, amount] of arena.contributions.entries()) {
      await coinService.addCoins(arena.guildId, userId, amount, 'arena', `Rückerstattung: ${arena.topic}`).catch(() => {});
    }
    // Gilden-Einsätze zurück
    for (const g of arena.guilds) {
      await GuildTeam.findByIdAndUpdate(g.teamId, { $inc: { treasury: g.wager } }).catch(() => {});
    }
    arena.status = 'beendet';
    await arena.save();
    return;
  }

  // Preise verteilen
  if (arena.type === 'einzeln') {
    for (const debater of arena.debaters) {
      const weight = voteMap.get(debater.userId) ?? 0;
      const payout = Math.floor((weight / totalWeight) * arena.prizePool);
      if (payout > 0) {
        await coinService.addCoins(arena.guildId, debater.userId, payout, 'arena', `Arena-Preisgeld: ${arena.topic}`).catch(() => {});
      }
      results.push({ debaterId: debater.userId, voteWeight: weight, payout });
    }
  } else {
    for (const g of arena.guilds) {
      const weight = voteMap.get(g.teamId) ?? 0;
      const payout = Math.floor((weight / totalWeight) * arena.prizePool);
      if (payout > 0) {
        await GuildTeam.findByIdAndUpdate(g.teamId, { $inc: { treasury: payout } }).catch(() => {});
      }
      results.push({ debaterId: g.teamId, voteWeight: weight, payout });
    }
  }

  arena.results = results;
  arena.status  = 'beendet';
  await arena.save();

  // Ergebnis im Debattenkanal posten und sperren
  if (arena.channelId && discordGuild) {
    const channel = await discordGuild.channels.fetch(arena.channelId).catch(() => null);
    if (channel) {
      const resultLines = results
        .sort((a, b) => b.payout - a.payout)
        .map((r, i) => {
          const label = arena.type === 'einzeln' ? `<@${r.debaterId}>` : (arena.guilds.find(g => g.teamId === r.debaterId)?.name ?? r.debaterId);
          return `${i + 1}. ${label} — ${r.voteWeight} Stimmengewicht → **${formatCoins(r.payout)}**`;
        }).join('\n');

      await channel.send({
        embeds: [createEmbed({
          title:       '🏆 Ergebnis',
          color:       COLORS.GOLD,
          description: resultLines || '*Keine Stimmen abgegeben.*',
        })],
      }).catch(() => {});

      // Kanal für alle sperren
      await channel.permissionOverwrites.set([
        { id: discordGuild.id, type: OverwriteType.Role, deny: [PermissionFlagsBits.SendMessages] },
      ]).catch(() => {});
    }
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  getArenaOverviewPayload,
  buildArenaDetailPayload,
  showCreateArenaModal,
  handleCreateArena,
  handleArenaTypeSelect,
  handleArenaDauerModal,
  handleArenaAnmelden,
  handleArenaGildeAnmelden,
  handleArenaWager,
  showArenaEinzahlenModal,
  handleArenaEinzahlen,
  handleArenaAbstimmen,
  handleArenaAbstimmungSelect,
  handleArenaPage,
  processArenaTransitions,
};
