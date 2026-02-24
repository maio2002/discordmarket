const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, EmbedBuilder,
} = require('discord.js');
const Proposal = require('../models/Proposal');
const Constitution = require('../models/Constitution');
const Election = require('../models/Election');
const GuildTeam = require('../models/GuildTeam');
const GuildConfig = require('../models/GuildConfig');
const { createEmbed, COLORS } = require('../utils/embedBuilder');
const { formatTimestamp } = require('../utils/formatters');
const { SERVERRAT } = require('../constants');
const logger = require('../utils/logger');

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

async function getServerratChannel(discordGuild) {
  const config = await GuildConfig.findOne({ guildId: discordGuild.id });
  if (!config?.serverratChannelId) return null;
  return discordGuild.channels.fetch(config.serverratChannelId).catch(() => null);
}

function buildProposalEmbed(proposal, team) {
  const yes = proposal.votes.filter(v => v.vote === 'yes').length;
  const no  = proposal.votes.filter(v => v.vote === 'no').length;
  const typeLabel = proposal.type === 'amendment' ? '📜 Verfassungsänderung' : '📋 Allgemeiner Antrag';
  const deadline = Math.floor(proposal.deadline.getTime() / 1000);

  const fields = [
    { name: 'Eingereicht von', value: `<@${proposal.submittedBy}> (${team?.name ?? '?'})`, inline: true },
    { name: 'Frist', value: `<t:${deadline}:R>`, inline: true },
    { name: 'Abstimmung', value: `✅ ${yes} Ja  |  ❌ ${no} Nein`, inline: true },
  ];

  if (proposal.type === 'amendment' && proposal.amendmentContent) {
    fields.push({ name: '📜 Neuer Verfassungstext', value: proposal.amendmentContent.substring(0, 400) + (proposal.amendmentContent.length > 400 ? '…' : '') });
  }

  const statusColor = proposal.status === 'active' ? COLORS.PRIMARY
    : proposal.status === 'passed' ? COLORS.SUCCESS : COLORS.ERROR;

  const statusLabel = proposal.status === 'active' ? '🗳️ Abstimmung läuft'
    : proposal.status === 'passed' ? '✅ Angenommen' : '❌ Abgelehnt';

  return createEmbed({
    title: `${typeLabel}: ${proposal.title}`,
    color: statusColor,
    description: proposal.content,
    fields,
    footer: statusLabel,
  });
}

function buildProposalButtons(proposalId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`rp_yes_${proposalId}`)
      .setLabel('Ja')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`rp_no_${proposalId}`)
      .setLabel('Nein')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
  );
}

function buildElectionEmbed(election) {
  const deadline = Math.floor(election.deadline.getTime() / 1000);
  const sorted = [...election.candidates].sort((a, b) => b.votes.length - a.votes.length);

  const candidateList = sorted.length
    ? sorted.map((c, i) => `**${i + 1}.** <@${c.userId}> — ${c.votes.length} Stimme(n)`).join('\n')
    : '*Noch keine Kandidaten*';

  const statusLabel = election.status === 'active' ? '🗳️ Läuft' : `🏆 Beendet${election.winnerId ? ` — Gewinner: <@${election.winnerId}>` : ''}`;

  return createEmbed({
    title: `🗳️ Wahl: ${election.title}`,
    color: election.status === 'active' ? COLORS.PRIMARY : COLORS.GOLD,
    fields: [
      { name: 'Rolle', value: `<@&${election.roleId}>`, inline: true },
      { name: 'Frist', value: `<t:${deadline}:R>`, inline: true },
      { name: 'Stimmen gesamt', value: `${election.voters.length}`, inline: true },
      { name: 'Kandidaten', value: candidateList },
    ],
    footer: statusLabel,
  });
}

function buildElectionButtons(election) {
  const disabled = election.status !== 'active';
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`el_cand_${election._id}`)
      .setLabel('Kandidieren')
      .setEmoji('🙋')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`el_vote_${election._id}`)
      .setLabel('Abstimmen')
      .setEmoji('🗳️')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled || election.candidates.length === 0),
  );
}

async function updateElectionMessage(election, discordGuild) {
  if (!election.channelId || !election.messageId) return;
  const channel = await discordGuild.channels.fetch(election.channelId).catch(() => null);
  if (!channel) return;
  const msg = await channel.messages.fetch(election.messageId).catch(() => null);
  if (!msg) return;
  await msg.edit({ embeds: [buildElectionEmbed(election)], components: [buildElectionButtons(election)] });
}

async function updateProposalMessage(proposal, discordGuild) {
  if (!proposal.channelId || !proposal.messageId) return;
  const channel = await discordGuild.channels.fetch(proposal.channelId).catch(() => null);
  if (!channel) return;
  const msg = await channel.messages.fetch(proposal.messageId).catch(() => null);
  if (!msg) return;
  const team = await GuildTeam.findById(proposal.teamId);
  const disabled = proposal.status !== 'active';
  await msg.edit({
    embeds: [buildProposalEmbed(proposal, team)],
    components: [buildProposalButtons(proposal._id, disabled)],
  });
}

// ─── Proposals ───────────────────────────────────────────────────────────────

async function handleProposalCreate(interaction) {
  const { guild, user } = interaction;

  const team = await GuildTeam.findOne({ guildId: guild.id, leaderId: user.id });
  if (!team) return interaction.reply({ content: '❌ Nur Gildenführer können Anträge einreichen.', ephemeral: true });

  const channel = await getServerratChannel(guild);
  if (!channel) return interaction.reply({ content: '❌ Kein Serverrat-Kanal konfiguriert. Admin: `/config serverratkanal #kanal`', ephemeral: true });

  const title = interaction.options.getString('titel');
  const content = interaction.options.getString('inhalt');
  const type = interaction.options.getString('typ') ?? 'motion';
  const amendmentContent = interaction.options.getString('verfassungstext') ?? null;

  if (type === 'amendment' && !amendmentContent) {
    return interaction.reply({ content: '❌ Bei Verfassungsänderungen muss `verfassungstext` angegeben werden.', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  const deadline = new Date(Date.now() + SERVERRAT.VOTE_DURATION_HOURS * 3_600_000);
  const proposal = await Proposal.create({
    guildId: guild.id, title, content, type, amendmentContent,
    submittedBy: user.id, teamId: team._id, deadline,
  });

  const embed = buildProposalEmbed(proposal, team);
  const msg = await channel.send({ content: `📋 Neuer Antrag von **${team.name}**!`, embeds: [embed], components: [buildProposalButtons(proposal._id)] });
  proposal.channelId = msg.channelId;
  proposal.messageId = msg.id;
  await proposal.save();

  return interaction.editReply({ content: `✅ Antrag **${title}** wurde im Serverrat eingereicht!` });
}

async function handleProposalList(interaction) {
  const proposals = await Proposal.find({ guildId: interaction.guild.id, status: 'active' });
  if (!proposals.length) return interaction.reply({ content: '📋 Keine aktiven Anträge.', ephemeral: true });

  const lines = proposals.map(p => {
    const yes = p.votes.filter(v => v.vote === 'yes').length;
    const no  = p.votes.filter(v => v.vote === 'no').length;
    return `• **${p.title}** — ✅ ${yes} / ❌ ${no}`;
  }).join('\n');

  const embed = createEmbed({ title: '📋 Aktive Anträge', color: COLORS.PRIMARY, description: lines });
  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleVote(interaction, vote) {
  const proposalId = interaction.customId.slice(7); // strip "rp_yes_" or "rp_no_"
  const { guild, user } = interaction;

  const proposal = await Proposal.findById(proposalId);
  if (!proposal || proposal.status !== 'active') {
    return interaction.reply({ content: '❌ Dieser Antrag ist nicht mehr aktiv.', ephemeral: true });
  }

  const team = await GuildTeam.findOne({ guildId: guild.id, leaderId: user.id });
  if (!team) return interaction.reply({ content: '❌ Nur Gildenführer können abstimmen.', ephemeral: true });

  const already = proposal.votes.find(v => v.teamId.toString() === team._id.toString());
  if (already) {
    return interaction.reply({ content: `❌ Deine Gilde hat bereits mit **${already.vote === 'yes' ? 'Ja' : 'Nein'}** gestimmt.`, ephemeral: true });
  }

  proposal.votes.push({ teamId: team._id, vote, votedBy: user.id });
  await proposal.save();
  await updateProposalMessage(proposal, guild);

  return interaction.reply({ content: `✅ Du hast für **${proposal.title}** mit **${vote === 'yes' ? 'Ja ✅' : 'Nein ❌'}** gestimmt.`, ephemeral: true });
}

// ─── Proposals auto-close (Cron) ─────────────────────────────────────────────

async function closeExpiredProposals(client) {
  const expired = await Proposal.find({ status: 'active', deadline: { $lt: new Date() } });
  for (const proposal of expired) {
    const yes = proposal.votes.filter(v => v.vote === 'yes').length;
    const no  = proposal.votes.filter(v => v.vote === 'no').length;
    const total = yes + no;

    let status = 'rejected';
    if (total >= SERVERRAT.QUORUM && yes / total > SERVERRAT.PASS_THRESHOLD) {
      status = 'passed';
    }
    proposal.status = status;
    await proposal.save();

    // Verfassung updaten bei Amendment
    if (status === 'passed' && proposal.type === 'amendment' && proposal.amendmentContent) {
      await Constitution.findOneAndUpdate(
        { guildId: proposal.guildId },
        { content: proposal.amendmentContent, $inc: { version: 1 }, editedBy: proposal.submittedBy },
        { upsert: true },
      );
    }

    // Nachricht im Serverrat updaten
    try {
      const guildObj = client.guilds.cache.get(proposal.guildId);
      if (guildObj) await updateProposalMessage(proposal, guildObj);
    } catch (err) {
      logger.warn(`Proposal-Update fehlgeschlagen: ${err.message}`);
    }
  }
}

// ─── Verfassung ───────────────────────────────────────────────────────────────

async function handleConstitutionView(interaction) {
  const doc = await Constitution.findOne({ guildId: interaction.guild.id });
  const content = doc?.content ?? '*(Noch keine Verfassung geschrieben.)*';
  const version = doc?.version ?? 0;

  const embed = createEmbed({
    title: '📜 Serververfassung',
    color: COLORS.GOLD,
    description: content.length > 4000 ? content.substring(0, 4000) + '…' : content,
    footer: `Version ${version}${doc?.editedBy ? ` · Zuletzt bearbeitet von einem Nutzer` : ''}`,
  });
  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleConstitutionEdit(interaction) {
  if (!interaction.member.permissions.has(require('discord.js').PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ Nur Admins können die Verfassung direkt bearbeiten.', ephemeral: true });
  }
  const text = interaction.options.getString('text');
  await Constitution.findOneAndUpdate(
    { guildId: interaction.guild.id },
    { content: text, $inc: { version: 1 }, editedBy: interaction.user.id },
    { upsert: true },
  );
  return interaction.reply({ content: '✅ Verfassung aktualisiert.', ephemeral: true });
}

// ─── Wahlen ───────────────────────────────────────────────────────────────────

async function handleElectionCreate(interaction) {
  if (!interaction.member.permissions.has(require('discord.js').PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ Nur Admins können Wahlen starten.', ephemeral: true });
  }

  const channel = await getServerratChannel(interaction.guild);
  if (!channel) return interaction.reply({ content: '❌ Kein Serverrat-Kanal konfiguriert.', ephemeral: true });

  const title = interaction.options.getString('titel');
  const role = interaction.options.getRole('rolle');
  const hours = (interaction.options.getInteger('stunden') ?? SERVERRAT.ELECTION_NOMINATION_HOURS)
    + SERVERRAT.ELECTION_VOTE_HOURS;
  const deadline = new Date(Date.now() + hours * 3_600_000);

  await interaction.deferReply({ ephemeral: true });

  const election = await Election.create({
    guildId: interaction.guild.id, title, roleId: role.id, deadline,
  });

  const msg = await channel.send({
    content: `🗳️ **Neue Wahl gestartet!** Kandidiert und stimmt ab!`,
    embeds: [buildElectionEmbed(election)],
    components: [buildElectionButtons(election)],
  });
  election.channelId = msg.channelId;
  election.messageId = msg.id;
  await election.save();

  return interaction.editReply({ content: `✅ Wahl **${title}** gestartet!` });
}

async function handleElectionList(interaction) {
  const elections = await Election.find({ guildId: interaction.guild.id, status: 'active' });
  if (!elections.length) return interaction.reply({ content: '🗳️ Keine aktiven Wahlen.', ephemeral: true });

  const lines = elections.map(e => `• **${e.title}** — ${e.candidates.length} Kandidat(en), ${e.voters.length} Stimme(n)`).join('\n');
  const embed = createEmbed({ title: '🗳️ Aktive Wahlen', color: COLORS.PRIMARY, description: lines });
  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleCandidacy(interaction) {
  const electionId = interaction.customId.slice(8); // strip "el_cand_"
  const { guild, user } = interaction;

  const election = await Election.findById(electionId);
  if (!election || election.status !== 'active') {
    return interaction.reply({ content: '❌ Diese Wahl ist nicht mehr aktiv.', ephemeral: true });
  }
  if (election.candidates.some(c => c.userId === user.id)) {
    return interaction.reply({ content: '❌ Du kandidierst bereits.', ephemeral: true });
  }

  const member = await guild.members.fetch(user.id).catch(() => null);
  election.candidates.push({ userId: user.id, name: member?.displayName ?? user.username });
  await election.save();
  await updateElectionMessage(election, guild);

  return interaction.reply({ content: `✅ Du kandidierst jetzt für **${election.title}**!`, ephemeral: true });
}

async function handleElectionVoteButton(interaction) {
  const electionId = interaction.customId.slice(8); // strip "el_vote_"
  const { guild, user } = interaction;

  const election = await Election.findById(electionId);
  if (!election || election.status !== 'active') {
    return interaction.reply({ content: '❌ Diese Wahl ist nicht mehr aktiv.', ephemeral: true });
  }
  if (election.voters.includes(user.id)) {
    return interaction.reply({ content: '❌ Du hast bereits abgestimmt.', ephemeral: true });
  }
  if (election.candidates.length === 0) {
    return interaction.reply({ content: '❌ Noch keine Kandidaten.', ephemeral: true });
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(`el_select_${electionId}`)
    .setPlaceholder('Kandidaten wählen…')
    .addOptions(election.candidates.map(c => ({
      label: c.name,
      value: c.userId,
      description: `Stimme für ${c.name}`,
    })));

  return interaction.reply({
    content: '🗳️ Wähle deinen Kandidaten:',
    components: [new ActionRowBuilder().addComponents(select)],
    ephemeral: true,
  });
}

async function handleElectionVoteSelect(interaction) {
  const electionId = interaction.customId.slice(10); // strip "el_select_"
  const { guild, user } = interaction;
  const candidateId = interaction.values[0];

  const election = await Election.findById(electionId);
  if (!election || election.status !== 'active') {
    return interaction.update({ content: '❌ Wahl nicht mehr aktiv.', components: [] });
  }
  if (election.voters.includes(user.id)) {
    return interaction.update({ content: '❌ Du hast bereits abgestimmt.', components: [] });
  }

  const candidate = election.candidates.find(c => c.userId === candidateId);
  if (!candidate) return interaction.update({ content: '❌ Kandidat nicht gefunden.', components: [] });

  candidate.votes.push(user.id);
  election.voters.push(user.id);
  await election.save();
  await updateElectionMessage(election, guild);

  return interaction.update({ content: `✅ Du hast für **${candidate.name}** gestimmt!`, components: [] });
}

// ─── Elections auto-close (Cron) ─────────────────────────────────────────────

async function closeExpiredElections(client) {
  const expired = await Election.find({ status: 'active', deadline: { $lt: new Date() } });
  for (const election of expired) {
    election.status = 'ended';

    if (election.candidates.length > 0) {
      const winner = election.candidates.reduce((a, b) => a.votes.length >= b.votes.length ? a : b);
      election.winnerId = winner.userId;

      // Rolle vergeben
      try {
        const guildObj = client.guilds.cache.get(election.guildId);
        if (guildObj) {
          const member = await guildObj.members.fetch(winner.userId).catch(() => null);
          if (member) {
            await member.roles.add(election.roleId).catch(() => {});
          }
          await updateElectionMessage(election, guildObj);
        }
      } catch (err) {
        logger.warn(`Election-Abschluss fehlgeschlagen: ${err.message}`);
      }
    }

    await election.save();
  }
}

module.exports = {
  handleProposalCreate,
  handleProposalList,
  handleVote,
  handleConstitutionView,
  handleConstitutionEdit,
  handleElectionCreate,
  handleElectionList,
  handleCandidacy,
  handleElectionVoteButton,
  handleElectionVoteSelect,
  closeExpiredProposals,
  closeExpiredElections,
};
