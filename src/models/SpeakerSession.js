const mongoose = require('mongoose');

const speakerSessionSchema = new mongoose.Schema({
  guildId:      { type: String, required: true },
  speakerId:    { type: String, required: true },
  channelId:    { type: String, required: true },
  startTime:    { type: Date, required: true },
  endTime:      { type: Date, default: null },
  peakAudience: { type: Number, default: 0 },
  avgAudience:  { type: Number, default: 0 },
  coinsAwarded: { type: Number, default: 0 },
  isActive:     { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('SpeakerSession', speakerSessionSchema);
