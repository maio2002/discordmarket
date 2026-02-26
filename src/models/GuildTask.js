const { Schema, model } = require('mongoose');

const guildTaskSchema = new Schema({
  guildId:     { type: String, required: true },
  teamId:      { type: String, required: true },
  title:       { type: String, required: true },
  description: { type: String, default: null },
  reward:      { type: Number, required: true },
  status:      { type: String, enum: ['open', 'claimed', 'submitted', 'completed', 'rejected'], default: 'open' },
  claimedBy:   { type: String, default: null },
  channelId:   { type: String, default: null },
  createdAt:   { type: Date, default: Date.now },
});

guildTaskSchema.index({ guildId: 1, teamId: 1, status: 1 });

module.exports = model('GuildTask', guildTaskSchema);
