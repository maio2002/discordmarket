const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  guildId:         { type: String, required: true },
  userId:          { type: String, required: true },
  xp:              { type: Number, default: 0 },
  level:           { type: Number, default: 0 },
  totalXpEarned:   { type: Number, default: 0 },
  coins:           { type: Number, default: 200 },
  lastMessageXp:   { type: Date, default: null },
  lastRoleBuy:     { type: Date, default: null },
  ownRoleCount:    { type: Number, default: 0 },
  jobType:         { type: String, default: null },
  jobAssignedAt:   { type: Date, default: null },
  lastPayday:      { type: Date, default: null },
  isMember:        { type: Boolean, default: false },
  isVip:           { type: Boolean, default: false },
  lastWeeklyBonus: { type: Date, default: null },
}, { timestamps: true });

userSchema.index({ guildId: 1, userId: 1 }, { unique: true });
userSchema.index({ guildId: 1, xp: -1 });

module.exports = mongoose.model('User', userSchema);
