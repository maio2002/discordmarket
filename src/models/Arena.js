const mongoose = require('mongoose');

const arenaSchema = new mongoose.Schema({
  guildId:     { type: String, required: true },
  creatorId:   { type: String, required: true },
  topic:       { type: String, required: true },
  description: { type: String, default: null },
  type:        { type: String, enum: ['einzeln', 'gilde'], required: true },
  status:      { type: String, enum: ['offen', 'aktiv', 'abstimmung', 'beendet'], default: 'offen' },

  // Einzeldebatte — angemeldete Debattanten
  debaters: [{
    userId: { type: String, required: true },
  }],

  // Gildenkampf — angemeldete Gilden
  guilds: [{
    teamId: { type: String, required: true },
    name:   { type: String, required: true },
    wager:  { type: Number, required: true },
  }],

  // Preispool (Einzahlungen der Zuschauer)
  prizePool:     { type: Number, default: 0 },
  contributions: { type: Map, of: Number, default: {} },

  // Abstimmung: voterId → debaterId (userId oder teamId)
  votes: { type: Map, of: String, default: {} },

  // Phase-Zeitstempel
  activeAt: { type: Date, required: true },  // offen  → aktiv
  voteAt:   { type: Date, required: true },  // aktiv  → abstimmung
  endsAt:   { type: Date, required: true },  // abstimmung → beendet

  // Optionaler Debattenkanal
  channelId: { type: String, default: null },

  // Ergebnisse (befüllt wenn beendet)
  results: [{
    debaterId:  { type: String, required: true },
    voteWeight: { type: Number, required: true },
    payout:     { type: Number, required: true },
  }],
}, { timestamps: true });

arenaSchema.index({ guildId: 1, status: 1 });
arenaSchema.index({ guildId: 1, createdAt: -1 });

module.exports = mongoose.model('Arena', arenaSchema);
