const mongoose = require('mongoose');

const proposalSchema = new mongoose.Schema({
  guildId:          { type: String, required: true },
  title:            { type: String, required: true },
  content:          { type: String, required: true },
  type:             { type: String, enum: ['motion', 'amendment'], default: 'motion' },
  amendmentContent: { type: String, default: null }, // neuer Verfassungstext bei type=amendment
  submittedBy:      { type: String, required: true }, // userId
  teamId:           { type: mongoose.Schema.Types.ObjectId, ref: 'GuildTeam', required: true },
  channelId:        { type: String, default: null },
  messageId:        { type: String, default: null },
  status:           { type: String, enum: ['active', 'passed', 'rejected', 'cancelled'], default: 'active' },
  votes: [{
    teamId:  { type: mongoose.Schema.Types.ObjectId, ref: 'GuildTeam' },
    vote:    { type: String, enum: ['yes', 'no'] },
    votedBy: { type: String },
  }],
  deadline: { type: Date, required: true },
}, { timestamps: true });

proposalSchema.index({ guildId: 1, status: 1 });

module.exports = mongoose.model('Proposal', proposalSchema);
