const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');
const SeatElection = require('../models/SeatElection');
const GuildTeam    = require('../models/GuildTeam');
const GuildConfig  = require('../models/GuildConfig');
const User         = require('../models/User');
const { createEmbed, COLORS } = require('../utils/embedBuilder');
const { SEATS, LEVEL } = require('../constants');
const logger = require('../utils/logger');

const MAX_SEATS = SEATS.MAX_SEATS;

// Stimmgewicht nach Rang-Stufe
const VOTE_WEIGHTS = [1, 1, 1, 2, 3, 5, 6, 7, 9, 12];
function voteWeight(level) {
  return VOTE_WEIGHTS[level] ?? 1;
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function getVoteCounts(election) {
  const counts = {};
  for (const v of election.votes) {
    const key = v.teamId.toString();
    counts[key] = (counts[key] ?? 0) + (v.weight ?? 1);
  }
  return counts;
}

// Größter-Rest-Methode (Hare-Quota)
function calculateSeats(voteCounts) {
  const totalVotes = Object.values(voteCounts).reduce((s, v) => s + v, 0);
  if (totalVotes === 0) return {};

  const quota = totalVotes / MAX_SEATS;
  const entries = Object.entries(voteCounts).map(([id, votes]) => ({
    id,
    auto:      Math.floor(votes / quota),
    remainder: (votes / quota) % 1,
  }));

  const assigned  = entries.reduce((s, e) => s + e.auto, 0);
  let   remaining = MAX_SEATS - assigned;

  entries.sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; i < remaining && i < entries.length; i++) entries[i].auto++;

  return Object.fromEntries(entries.map(e => [e.id, e.auto]));
}

function buildSeatVoteButton(electionId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`seat_vote_${electionId}`)
      .setLabel('Fraktion wählen')
      .setEmoji('🗳️')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
  );
}

function buildSeatElectionEmbed(election, teams, voteCounts) {
  const deadline  = Math.floor(election.deadline.getTime() / 1000);
  const totalVotes = Object.values(voteCounts).reduce((s, v) => s + v, 0);
  const active = election.status === 'active';

  const lines = teams.length
    ? teams
        .sort((a, b) => (voteCounts[b._id.toString()] ?? 0) - (voteCounts[a._id.toString()] ?? 0))
        .map(t => {
          const votes = voteCounts[t._id.toString()] ?? 0;
          const pct   = totalVotes > 0 ? ((votes / totalVotes) * 100).toFixed(1) : '0.0';
          return `**${t.name}** — ${votes} Stimme(n) (${pct}%)`;
        }).join('\n')
    : '*Noch keine Fraktionen vorhanden*';

  return createEmbed({
    title:  '🗳️ Monatliche Sitzwahl',
    color:  active ? COLORS.PRIMARY : COLORS.GOLD,
    description: lines,
    fields: [
      { name: 'Frist',         value: `<t:${deadline}:R>`,   inline: true },
      { name: 'Stimmen',       value: `${totalVotes}`,        inline: true },
      { name: 'Sitze (max.)',  value: `${MAX_SEATS}`,         inline: true },
    ],
    footer: active ? '🗳️ Wahl läuft — Stimmgewicht: Händler×2, Bürger×3, Ritter×5, Mönch×6, Priester×7, Graf×9, König×12' : '✅ Wahl beendet',
  });
}

async function updateSeatElectionMessage(election, discordGuild) {
  if (!election.channelId || !election.messageId) return;
  const channel = await discordGuild.channels.fetch(election.channelId).catch(() => null);
  if (!channel) return;
  const msg = await channel.messages.fetch(election.messageId).catch(() => null);
  if (!msg) return;

  const teams      = await GuildTeam.find({ guildId: discordGuild.id });
  const voteCounts = getVoteCounts(election);
  const disabled   = election.status !== 'active';

  await msg.edit({
    embeds:     [buildSeatElectionEmbed(election, teams, voteCounts)],
    components: disabled ? [] : [buildSeatVoteButton(election._id)],
  });
}

// ─── Wahl starten ─────────────────────────────────────────────────────────────

async function startSeatElection(discordGuild) {
  const existing = await SeatElection.findOne({ guildId: discordGuild.id, status: 'active' });
  if (existing) return null; // bereits aktiv

  const deadline = new Date(Date.now() + SEATS.ELECTION_DAYS * 86_400_000);
  const election = await SeatElection.create({ guildId: discordGuild.id, deadline });

  // Nachricht im konfigurierten Kanal posten — optional
  const config = await GuildConfig.findOne({ guildId: discordGuild.id });
  if (config?.seatElectionChannelId) {
    const channel = await discordGuild.channels.fetch(config.seatElectionChannelId).catch(() => null);
    if (channel) {
      const teams = await GuildTeam.find({ guildId: discordGuild.id });
      const msg   = await channel.send({
        content:    '🗳️ **Die monatliche Sitzwahl hat begonnen!** Wähle jetzt deine Fraktion!',
        embeds:     [buildSeatElectionEmbed(election, teams, {})],
        components: [buildSeatVoteButton(election._id)],
      }).catch(() => null);
      if (msg) {
        election.channelId = msg.channelId;
        election.messageId = msg.id;
        await election.save();
      }
    }
  }

  logger.info(`Sitzwahl für Guild ${discordGuild.id} gestartet (${SEATS.ELECTION_DAYS} Tage).`);
  return election;
}

// ─── Wahl schließen (Cron) ────────────────────────────────────────────────────

async function closeSeatElections(client) {
  const expired = await SeatElection.find({ status: 'active', deadline: { $lt: new Date() } });

  for (const election of expired) {
    election.status = 'ended';
    await election.save();

    const voteCounts = getVoteCounts(election);
    const seatMap    = calculateSeats(voteCounts);

    const config = await GuildConfig.findOne({ guildId: election.guildId });
    const teams  = await GuildTeam.find({ guildId: election.guildId });

    for (const team of teams) {
      const newSeats = seatMap[team._id.toString()] ?? 0;

      // Überschüssige Sitze entziehen
      if (newSeats < team.assignedSeats.length) {
        const toRemove = team.assignedSeats.slice(newSeats);
        team.assignedSeats = team.assignedSeats.slice(0, newSeats);

        if (config?.sitzRoleId) {
          const guildObj = client.guilds.cache.get(election.guildId);
          for (const userId of toRemove) {
            const member = await guildObj?.members.fetch(userId).catch(() => null);
            if (member) await member.roles.remove(config.sitzRoleId).catch(() => {});
          }
        }
      }

      team.seats = newSeats;
      await team.save();
    }

    // Nachricht aktualisieren
    try {
      const guildObj = client.guilds.cache.get(election.guildId);
      if (guildObj) await updateSeatElectionMessage(election, guildObj);
    } catch (err) {
      logger.warn(`Sitzwahl-Update fehlgeschlagen: ${err.message}`);
    }

    logger.info(`Sitzwahl für Guild ${election.guildId} beendet. Sitze vergeben.`);
  }
}

// ─── Button: Abstimmen ────────────────────────────────────────────────────────

async function handleSeatVoteButton(interaction) {
  const electionId = interaction.customId.slice('seat_vote_'.length);
  const { guild, user } = interaction;

  const election = await SeatElection.findById(electionId);
  if (!election || election.status !== 'active') {
    return interaction.reply({ content: '❌ Diese Wahl ist nicht mehr aktiv.', ephemeral: true });
  }
  if (election.votes.some(v => v.userId === user.id)) {
    return interaction.reply({ content: '❌ Du hast bereits abgestimmt.', ephemeral: true });
  }

  const teams = await GuildTeam.find({ guildId: guild.id });
  if (!teams.length) {
    return interaction.reply({ content: '❌ Keine Fraktionen vorhanden.', ephemeral: true });
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(`seat_select_${electionId}`)
    .setPlaceholder('Fraktion wählen…')
    .addOptions(teams.map(t => ({
      label:       t.name,
      value:       t._id.toString(),
      description: `Für ${t.name} stimmen`,
    })));

  return interaction.reply({
    content:    '🗳️ Wähle deine Fraktion:',
    components: [new ActionRowBuilder().addComponents(select)],
    ephemeral:  true,
  });
}

async function handleSeatVoteSelect(interaction) {
  const electionId = interaction.customId.slice('seat_select_'.length);
  const { guild, user } = interaction;
  const teamId = interaction.values[0];

  const election = await SeatElection.findById(electionId);
  if (!election || election.status !== 'active') {
    return interaction.update({ content: '❌ Wahl nicht mehr aktiv.', components: [] });
  }
  if (election.votes.some(v => v.userId === user.id)) {
    return interaction.update({ content: '❌ Du hast bereits abgestimmt.', components: [] });
  }

  const team = await GuildTeam.findById(teamId);
  if (!team) return interaction.update({ content: '❌ Fraktion nicht gefunden.', components: [] });

  const userDoc = await User.findOne({ guildId: guild.id, userId: user.id });
  const weight  = voteWeight(userDoc?.level ?? 0);
  const rankName = userDoc?.level > 0 ? (LEVEL.RANKS[userDoc.level - 1]?.name ?? 'Unbekannt') : 'Kein Rang';

  election.votes.push({ userId: user.id, teamId, weight });
  await election.save();

  updateSeatElectionMessage(election, guild).catch(() => {});

  const weightInfo = weight > 1 ? ` *(${rankName} — **${weight}× Stimmgewicht**)` : '';
  return interaction.update({ content: `✅ Du hast für **${team.name}** gestimmt!${weightInfo}`, components: [] });
}

// ─── Sitze verwalten (kombiniert) ─────────────────────────────────────────────

async function buildSeatManagePayload(guild, team) {
  const embed = createEmbed({
    title:       `🏛️ Sitzverwaltung — ${team.name}`,
    color:       COLORS.PRIMARY,
    description: `**${team.assignedSeats.length}/${team.seats}** Sitz(e) vergeben.`,
    fields:      team.assignedSeats.length
      ? [{ name: 'Aktuelle Sitzinhaber', value: team.assignedSeats.map(id => `• <@${id}>`).join('\n') }]
      : [],
  });

  const components = [];

  // Vergeben-Select: Mitglieder ohne Sitz, wenn noch Plätze frei
  if (team.assignedSeats.length < team.seats) {
    const eligible = team.members.filter(id => !team.assignedSeats.includes(id));
    const opts = [];
    for (const id of eligible) {
      const m = await guild.members.fetch(id).catch(() => null);
      if (m) opts.push({ label: m.displayName.slice(0, 100), value: id, description: m.user.username.slice(0, 100) });
    }
    if (opts.length) {
      components.push(new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`seat_assign_select_${team._id}`)
          .setPlaceholder('Sitz vergeben an…')
          .addOptions(opts.slice(0, 25)),
      ));
    }
  }

  // Entziehen-Select: Mitglieder mit Sitz
  if (team.assignedSeats.length) {
    const opts = [];
    for (const id of team.assignedSeats) {
      const m = await guild.members.fetch(id).catch(() => null);
      opts.push({ label: m ? m.displayName.slice(0, 100) : id, value: id });
    }
    components.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`seat_revoke_select_${team._id}`)
        .setPlaceholder('Sitz entziehen von…')
        .addOptions(opts.slice(0, 25)),
    ));
  }

  return { embeds: [embed], components };
}

async function handleSeatManage(interaction) {
  const { guild, user } = interaction;
  const team = await GuildTeam.findOne({ guildId: guild.id, leaderId: user.id });
  if (!team) return interaction.reply({ content: '❌ Nur Fraktionsführer können Sitze verwalten.', ephemeral: true });
  if (team.seats === 0) return interaction.reply({ content: '❌ Deine Fraktion hat keine Sitze (Ergebnis der letzten Sitzwahl).', ephemeral: true });

  const payload = await buildSeatManagePayload(guild, team);
  if (!payload.components.length) {
    return interaction.reply({ content: `ℹ️ Alle ${team.seats} Sitz(e) sind vergeben und alle Mitglieder haben bereits einen Sitz.`, ephemeral: true });
  }
  return interaction.reply({ ...payload, ephemeral: true });
}

async function handleSeatAssignSelect(interaction) {
  const teamId   = interaction.customId.slice('seat_assign_select_'.length);
  const { guild, user } = interaction;
  const targetId = interaction.values[0];

  const team = await GuildTeam.findById(teamId);
  if (!team || team.leaderId !== user.id) return interaction.update({ content: '❌ Keine Berechtigung.', embeds: [], components: [] });
  if (!team.members.includes(targetId)) return interaction.update({ content: '❌ Mitglied nicht mehr in der Fraktion.', embeds: [], components: [] });
  if (team.assignedSeats.includes(targetId)) return interaction.update({ content: '❌ Dieses Mitglied hat bereits einen Sitz.', embeds: [], components: [] });
  if (team.assignedSeats.length >= team.seats) return interaction.update({ content: `❌ Alle ${team.seats} Sitz(e) sind bereits vergeben.`, embeds: [], components: [] });

  team.assignedSeats.push(targetId);
  await team.save();

  const config = await GuildConfig.findOne({ guildId: guild.id });
  const member  = await guild.members.fetch(targetId).catch(() => null);

  if (config && !config.sitzRoleId) {
    try {
      const role = await guild.roles.create({ name: 'Ratsabgeordneter', mentionable: false, reason: 'Sitz-Rolle automatisch erstellt' });
      config.sitzRoleId = role.id;
      await config.save();
      logger.info(`Sitz-Rolle für Guild ${guild.id} automatisch erstellt: ${role.id}`);
    } catch (err) {
      logger.warn(`Sitz-Rolle konnte nicht erstellt werden: ${err.message}`);
    }
  }
  if (config?.sitzRoleId && member) await member.roles.add(config.sitzRoleId).catch(() => {});

  const payload = await buildSeatManagePayload(guild, team);
  return interaction.update({ ...payload, content: `✅ <@${targetId}> hat einen Sitz erhalten.` });
}

async function handleSeatRevokeSelect(interaction) {
  const teamId   = interaction.customId.slice('seat_revoke_select_'.length);
  const { guild, user } = interaction;
  const targetId = interaction.values[0];

  const team = await GuildTeam.findById(teamId);
  if (!team || team.leaderId !== user.id) return interaction.update({ content: '❌ Keine Berechtigung.', embeds: [], components: [] });
  if (!team.assignedSeats.includes(targetId)) return interaction.update({ content: '❌ Dieses Mitglied hat keinen Sitz in deiner Fraktion.', embeds: [], components: [] });

  team.assignedSeats = team.assignedSeats.filter(id => id !== targetId);
  await team.save();

  const config = await GuildConfig.findOne({ guildId: guild.id });
  const member  = await guild.members.fetch(targetId).catch(() => null);
  if (config?.sitzRoleId && member) await member.roles.remove(config.sitzRoleId).catch(() => {});

  const payload = await buildSeatManagePayload(guild, team);
  return interaction.update({ ...payload, content: `✅ <@${targetId}> wurde der Sitz entzogen.` });
}

// ─── Sitzverteilung anzeigen ──────────────────────────────────────────────────

async function handleSeatList(interaction) {
  const { guild } = interaction;

  // Aktive Wahl prüfen
  const election = await SeatElection.findOne({ guildId: guild.id, status: 'active' });

  if (election) {
    const teams      = await GuildTeam.find({ guildId: guild.id });
    const voteCounts = getVoteCounts(election);
    const embed      = buildSeatElectionEmbed(election, teams, voteCounts);

    const alreadyVoted = election.votes.some(v => v.userId === interaction.user.id);
    const row = alreadyVoted ? [] : [buildSeatVoteButton(election._id)];

    return interaction.update({ embeds: [embed], components: row });
  }

  // Keine aktive Wahl — Sitzverteilung + nächste Wahl anzeigen
  const teams = await GuildTeam.find({ guildId: guild.id });

  const totalSeats    = teams.reduce((s, t) => s + t.seats, 0);
  const totalAssigned = teams.reduce((s, t) => s + t.assignedSeats.length, 0);

  const lines = teams
    .filter(t => t.seats > 0 || t.members.length > 0)
    .sort((a, b) => b.seats - a.seats)
    .map(t => {
      const bar = t.seats > 0
        ? `${'█'.repeat(t.assignedSeats.length)}${'░'.repeat(t.seats - t.assignedSeats.length)} ${t.assignedSeats.length}/${t.seats}`
        : '—';
      return `**${t.name}** — ${bar}`;
    });

  // Nächste Wahl: immer am 1. des nächsten Monats
  const now = new Date();
  const nextElection = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0);
  const nextTs = Math.floor(nextElection.getTime() / 1000);

  const embed = createEmbed({
    title:       '🏛️ Sitzverteilung',
    color:       COLORS.GOLD,
    description: lines.length ? lines.join('\n') : '*Noch keine Sitze vergeben*',
    fields: [
      { name: 'Nächste Sitzwahl', value: `<t:${nextTs}:F> (<t:${nextTs}:R>)`, inline: false },
    ],
    footer: `${totalAssigned}/${totalSeats} Sitze besetzt · max. ${MAX_SEATS}`,
  });

  return interaction.update({ embeds: [embed], components: [] });
}

module.exports = {
  startSeatElection,
  closeSeatElections,
  handleSeatVoteButton,
  handleSeatVoteSelect,
  handleSeatManage,
  handleSeatAssignSelect,
  handleSeatRevokeSelect,
  handleSeatList,
};
