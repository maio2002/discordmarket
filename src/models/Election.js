const mongoose = require('mongoose');

const electionSchema = new mongoose.Schema({
  guildId:    { type: String, required: true },
  title:      { type: String, required: true },
  roleId:     { type: String, required: true },
  channelId:  { type: String, default: null },
  messageId:  { type: String, default: null },
  candidates: [{
    userId:   { type: String, required: true },
    name:     { type: String, required: true },
    votes:    { type: [String], default: [] }, // userIds die für diesen Kandidaten gestimmt haben
  }],
  voters:   { type: [String], default: [] }, // alle userIds die schon abgestimmt haben
  status:   { type: String, enum: ['active', 'ended'], default: 'active' },
  deadline: { type: Date, required: true },
  winnerId: { type: String, default: null },
}, { timestamps: true });

electionSchema.index({ guildId: 1, status: 1 });

module.exports = mongoose.model('Election', electionSchema);
