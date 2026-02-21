const mongoose = require('mongoose');

const serviceRequestSchema = new mongoose.Schema({
  guildId:      { type: String, required: true },
  userId:       { type: String, required: true },
  name:         { type: String, required: true },
  description:  { type: String, required: true },
  price:        { type: Number, required: true },
  status:       { type: String, enum: ['pending', 'approved', 'denied'], default: 'pending' },
  reviewedBy:   { type: String, default: null },
  reviewedAt:   { type: Date, default: null },
  denyReason:   { type: String, default: null },
  serviceId:    { type: String, default: null },
  messageId:    { type: String, default: null },
  channelId:    { type: String, default: null },
}, { timestamps: true });

serviceRequestSchema.index({ guildId: 1, userId: 1 });

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);
