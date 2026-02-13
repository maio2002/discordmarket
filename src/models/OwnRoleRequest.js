const mongoose = require('mongoose');

const ownRoleRequestSchema = new mongoose.Schema({
  guildId:    { type: String, required: true },
  userId:     { type: String, required: true },
  roleName:   { type: String, required: true },
  roleColor:  { type: String, required: true },
  cost:       { type: Number, required: true },
  status:     { type: String, enum: ['pending', 'approved', 'denied'], default: 'pending' },
  reviewedBy: { type: String, default: null },
  reviewedAt: { type: Date, default: null },
  denyReason: { type: String, default: null },
  roleId:     { type: String, default: null },
  messageId:  { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('OwnRoleRequest', ownRoleRequestSchema);
