const { Schema, model } = require('mongoose');

const offerSchema = new Schema({
  guildId:     { type: String, required: true },
  senderId:    { type: String, required: true },
  targetId:    { type: String, required: true },
  type:        { type: String, enum: ['coins', 'offer', 'role', 'service', 'notification'], required: true },
  description: { type: String, default: null },
  price:       { type: Number, default: 0 },
  roleId:      { type: String, default: null },
  roleName:    { type: String, default: null },
  serviceName: { type: String, default: null },
  messageId:   { type: String, default: null },
  channelId:   { type: String, default: null },
  status:      { type: String, enum: ['pending', 'accepted', 'denied'], default: 'pending' },
  createdAt:   { type: Date, default: Date.now },
});

offerSchema.index({ guildId: 1, targetId: 1, status: 1 });

module.exports = model('Offer', offerSchema);