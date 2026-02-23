const mongoose = require('mongoose');

const questSchema = new mongoose.Schema({
  guildId:     { type: String, required: true },
  title:       { type: String, required: true },
  description: { type: String, required: true },
  reward:      { type: Number, required: true },
  condition:   { type: String, required: true },
  createdBy:   { type: String, required: true },
  status:      { type: String, enum: ['open', 'completed', 'cancelled'], default: 'open' },
  participants: [{
    userId:      { type: String, required: true },
    channelId:   { type: String, default: null },
    completed:   { type: Boolean, default: false },
    joinedAt:    { type: Date, default: Date.now },
    lastQuizAt:  { type: Date, default: null },
  }],
  examinerId:  { type: String, default: null },
}, { timestamps: true });

questSchema.index({ guildId: 1, status: 1 });

module.exports = mongoose.model('Quest', questSchema);
