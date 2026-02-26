const { Schema, model } = require('mongoose');

const guildTaskSchema = new Schema({
  guildId:     { type: String, required: true },
  teamId:      { type: String, required: true },
  title:       { type: String, required: true },
  description: { type: String, default: null },
  reward:      { type: Number, required: true },
  type:        { type: String, enum: ['einmalig', 'dauerhaft'], required: true },
  slots:       { type: Number, default: 1 },
  applicants:  { type: [String], default: [] },
  assignees: [{
    userId:      { type: String, required: true },
    channelId:   { type: String, default: null },
    assignedAt:  { type: Date, default: Date.now },
    submittedAt: { type: Date, default: null },
    status:      { type: String, enum: ['active', 'submitted'], default: 'active' },
  }],
  createdAt: { type: Date, default: Date.now },
});

guildTaskSchema.index({ guildId: 1, teamId: 1 });

module.exports = model('GuildTask', guildTaskSchema);
