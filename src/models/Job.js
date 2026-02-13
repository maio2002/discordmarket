const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  guildId:    { type: String, required: true },
  userId:     { type: String, required: true },
  type:       { type: String, enum: ['moderator', 'support', 'advertisement', 'examiner'], required: true },
  salary:     { type: Number, required: true },
  assignedAt: { type: Date, default: Date.now },
  assignedBy: { type: String, required: true },
  isActive:   { type: Boolean, default: true },
  lastPayday: { type: Date, default: null },
}, { timestamps: true });

jobSchema.index({ guildId: 1, userId: 1, isActive: 1 });

module.exports = mongoose.model('Job', jobSchema);
