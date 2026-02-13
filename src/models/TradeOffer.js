const mongoose = require('mongoose');

const tradeOfferSchema = new mongoose.Schema({
  guildId:        { type: String, required: true },
  sellerId:       { type: String, required: true },
  type:           { type: String, enum: ['role', 'service'], required: true },
  description:    { type: String, required: true },
  roleId:         { type: String, default: null },
  roleName:       { type: String, default: null },
  price:          { type: Number, required: true },
  status:         {
    type: String,
    enum: ['active', 'pending_approval', 'completed', 'denied', 'cancelled'],
    default: 'active',
  },
  buyerId:             { type: String, default: null },
  sellerApproved:      { type: Boolean, default: false },
  buyerApproved:       { type: Boolean, default: false },
  roleHolderApproved:  { type: Boolean, default: null },
  messageId:           { type: String, default: null },
}, { timestamps: true });

tradeOfferSchema.index({ guildId: 1, status: 1 });
tradeOfferSchema.index({ guildId: 1, sellerId: 1 });

module.exports = mongoose.model('TradeOffer', tradeOfferSchema);
