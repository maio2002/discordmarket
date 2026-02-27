const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const seatService   = require('../../services/seatService');
const { createGuildChannels } = require('../../services/guildService');
const SeatElection  = require('../../models/SeatElection');
const GuildTeam     = require('../../models/GuildTeam');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sitzwahl')
    .setDescription('Sitzwahl-Verwaltung (Admin)')
    .addSubcommand(sub =>
      sub
        .setName('starten')
        .setDescription('Sitzwahl jetzt manuell starten (benötigt konfigurierten Kanal)'),
    )
    .addSubcommand(sub =>
      sub
        .setName('simulieren')
        .setDescription('Wahl mit zufälligen Stimmen simulieren und sofort auswerten')
        .addIntegerOption(opt =>
          opt
            .setName('stimmen')
            .setDescription('Gesamtstimmen für die Simulation (Standard: 100)')
            .setRequired(false)
            .setMinValue(10)
            .setMaxValue(1000),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName('schliessen')
        .setDescription('Aktive Sitzwahl sofort schließen und Sitze berechnen'),
    )
    .addSubcommand(sub =>
      sub
        .setName('testfraktionen')
        .setDescription('4 Test-Fraktionen erstellen (nur wenn noch keine vorhanden)'),
    )
    .addSubcommand(sub =>
      sub
        .setName('testgilden')
        .setDescription('4 Test-Gilden erstellen (leiterlos, beitretbar)'),
    )
    .addSubcommand(sub =>
      sub
        .setName('fraktionen_reset')
        .setDescription('⚠️ Alle Fraktionen und aktive Sitzwahlen löschen'),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const sub   = interaction.options.getSubcommand();
    const { guild } = interaction;

    // ── Manuell starten ───────────────────────────────────────────────────────
    if (sub === 'starten') {
      await interaction.deferReply({ ephemeral: true });
      const election = await seatService.startSeatElection(guild);
      if (!election) {
        return interaction.editReply({ content: '❌ Konnte nicht starten — es läuft bereits eine Wahl.' });
      }
      return interaction.editReply({ content: '✅ Sitzwahl manuell gestartet!' });
    }

    // ── Simulieren ────────────────────────────────────────────────────────────
    if (sub === 'simulieren') {
      await interaction.deferReply({ ephemeral: true });

      const totalVotes = interaction.options.getInteger('stimmen') ?? 100;
      const teams = await GuildTeam.find({ guildId: guild.id });
      if (!teams.length) {
        return interaction.editReply({
          content: '❌ Keine Fraktionen vorhanden. Erstelle zuerst welche (`/sitzwahl testfraktionen` oder `/gilden`).',
        });
      }

      // Bestehende aktive Wahl löschen, damit sauber gestartet wird
      await SeatElection.deleteMany({ guildId: guild.id, status: 'active' });

      // Gewichtung zufällig, mindestens 1 Stimme pro Fraktion
      const rawWeights = teams.map(() => Math.random() * 10 + 1);
      const totalWeight = rawWeights.reduce((s, w) => s + w, 0);
      const voteCounts  = rawWeights.map(w => Math.max(1, Math.round((w / totalWeight) * totalVotes)));

      // Fake-Votes bauen
      const votes = [];
      for (let t = 0; t < teams.length; t++) {
        for (let i = 0; i < voteCounts[t]; i++) {
          votes.push({ userId: `sim_${t}_${i}`, teamId: teams[t]._id });
        }
      }

      // Abgelaufene Election erstellen
      const election = await SeatElection.create({
        guildId:  guild.id,
        deadline: new Date(Date.now() - 1000),
        votes,
      });

      // Über seatService schließen lassen (berechnet und speichert Sitze)
      await seatService.closeSeatElections(interaction.client);

      // Ergebnis aus DB lesen
      const updated = await GuildTeam.find({ guildId: guild.id }).sort({ seats: -1 });
      const realTotal = votes.length;

      const lines = updated.map(t => {
        const v = votes.filter(vt => vt.teamId.toString() === t._id.toString()).length;
        const pct = ((v / realTotal) * 100).toFixed(1);
        return `**${t.name}** — ${v} Stimmen (${pct}%) → **${t.seats} Sitze**`;
      });

      return interaction.editReply({
        content:
          `✅ Simulation abgeschlossen!\n` +
          `Stimmen gesamt: **${realTotal}** | Fraktionen: **${teams.length}** | Sitze max.: **67**\n\n` +
          lines.join('\n'),
      });
    }

    // ── Schließen ─────────────────────────────────────────────────────────────
    if (sub === 'schliessen') {
      const election = await SeatElection.findOne({ guildId: guild.id, status: 'active' });
      if (!election) {
        return interaction.reply({ content: '❌ Keine aktive Sitzwahl gefunden.', ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });
      election.deadline = new Date(Date.now() - 1000);
      await election.save();
      await seatService.closeSeatElections(interaction.client);
      return interaction.editReply({ content: '✅ Sitzwahl geschlossen und Sitze berechnet.' });
    }

    // ── Test-Fraktionen erstellen ─────────────────────────────────────────────
    if (sub === 'testfraktionen') {
      const existing = await GuildTeam.countDocuments({ guildId: guild.id });
      if (existing > 0) {
        return interaction.reply({
          content: `❌ Es gibt bereits **${existing}** Fraktion(en). Dieser Befehl funktioniert nur wenn noch keine Fraktionen vorhanden sind.`,
          ephemeral: true,
        });
      }

      const testData = [
        { name: 'Eisenfaust',    description: 'Kriegerische Fraktion des Nordens' },
        { name: 'Goldener Kelch',description: 'Händler und Kaufleute des Marktes' },
        { name: 'Silberzirkel',  description: 'Magier und Gelehrte' },
        { name: 'Grüner Pfad',   description: 'Naturverbundene Waldläufer' },
      ];

      await interaction.deferReply({ ephemeral: true });

      const created = [];
      for (let i = 0; i < testData.length; i++) {
        const fakeLeader = `test_leader_${i}_${Date.now()}`;
        const team = await GuildTeam.create({
          guildId:     guild.id,
          name:        testData[i].name,
          description: testData[i].description,
          leaderId:    fakeLeader,
          members:     [],
          leaderless:  true,
        });

        try {
          const channelIds = await createGuildChannels(guild, team);
          team.channels = channelIds;
          await team.save();
        } catch {
          // Marker nicht konfiguriert — ignorieren
        }

        created.push(testData[i].name);
      }

      return interaction.editReply({
        content:
          `✅ **${created.length} Test-Fraktionen** erstellt:\n` +
          created.map(n => `• ${n}`).join('\n') +
          '\n\nJetzt /sitzwahl simulieren ausführen!',
      });
    }

    // ── Test-Gilden erstellen ─────────────────────────────────────────────────
    if (sub === 'testgilden') {
      const testData = [
        { name: 'Drachenklaue',  description: 'Furchtlose Krieger und Abenteurer' },
        { name: 'Schattenweber', description: 'Meister der Täuschung und des Schattens' },
        { name: 'Goldgilde',     description: 'Händler, Handwerker und Schatzsucher' },
        { name: 'Lichtwächter',  description: 'Hüter des Friedens und der Ordnung' },
      ];

      await interaction.deferReply({ ephemeral: true });

      const created = [];
      for (let i = 0; i < testData.length; i++) {
        const fakeLeader = `test_guild_leader_${i}_${Date.now()}`;

        // Rolle vorab erstellen, damit Kanäle sofort sichtbar sind
        let roleId = null;
        try {
          const role = await guild.roles.create({ name: testData[i].name, mentionable: false, reason: `Test-Gilden-Rolle: ${testData[i].name}` });
          roleId = role.id;
        } catch { /* ignorieren */ }

        const team = await GuildTeam.create({
          guildId:     guild.id,
          name:        testData[i].name,
          description: testData[i].description,
          leaderId:    fakeLeader,
          members:     [],
          leaderless:  true,
          roleId,
        });

        try {
          const channelIds = await createGuildChannels(guild, team);
          team.channels = channelIds;
          await team.save();
        } catch {
          // Kanäle konnten nicht erstellt werden (z.B. kein Marker konfiguriert) — ignorieren
        }

        created.push(testData[i].name);
      }

      return interaction.editReply({
        content:
          `✅ **${created.length} Test-Gilden** erstellt:\n` +
          created.map(n => `• ${n}`).join('\n') +
          '\n\nNutzer können mit `/gilden` beitreten oder die Führung übernehmen.',
      });
    }

    // ── Fraktionen zurücksetzen ───────────────────────────────────────────────
    if (sub === 'fraktionen_reset') {
      await interaction.deferReply({ ephemeral: true });

      const teams = await GuildTeam.find({ guildId: guild.id });

      // Discord-Rollen und Kanäle löschen
      for (const team of teams) {
        if (team.channels) {
          for (const chId of [team.channels.chatId, team.channels.voiceId, team.channels.newsId, team.channels.categoryId]) {
            if (!chId) continue;
            await guild.channels.fetch(chId).then(ch => ch?.delete()).catch(() => {});
          }
        }
        if (team.roleId) {
          await guild.roles.fetch(team.roleId).then(r => r?.delete()).catch(() => {});
        }
      }

      const deletedTeams     = await GuildTeam.deleteMany({ guildId: guild.id });
      const deletedElections = await SeatElection.deleteMany({ guildId: guild.id });

      return interaction.editReply({
        content:
          `🗑️ Reset abgeschlossen:\n` +
          `• **${deletedTeams.deletedCount}** Fraktion(en) gelöscht\n` +
          `• **${deletedElections.deletedCount}** Sitzwahl(en) gelöscht`,
      });
    }
  },
};
