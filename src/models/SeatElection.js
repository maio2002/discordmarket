const mongoose = require('mongoose');

const seatElectionSchema = new mongoose.Schema({
  guildId:   { type: String, required: true },
  status:    { type: String, enum: ['active', 'ended'], default: 'active' },
  deadline:  { type: Date, required: true },
  votes: [{
    userId: { type: String },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'GuildTeam' },
  }],
  channelId: { type: String, default: null },
  messageId: { type: String, default: null },
}, { timestamps: true });

seatElectionSchema.index({ guildId: 1, status: 1 });

module.exports = mongoose.model('SeatElection', seatElectionSchema);
