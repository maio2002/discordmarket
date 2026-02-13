const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  guildId:      { type: String, required: true },
  userId:       { type: String, required: true },
  targetId:     { type: String, default: null },
  type:         {
    type: String,
    enum: [
      'message_xp', 'voice_xp', 'weekly_bonus', 'job_salary',
      'role_purchase', 'own_role', 'prestige', 'trade',
      'admin_give', 'admin_remove', 'speaker', 'examination',
    ],
    required: true,
  },
  amount:       { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  description:  { type: String, default: null },
}, { timestamps: true });

transactionSchema.index({ guildId: 1, userId: 1, createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
