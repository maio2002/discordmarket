const mongoose = require('mongoose');

const marketRoleSchema = new mongoose.Schema({
  guildId:    { type: String, required: true },
  roleId:     { type: String, default: null },
  name:       { type: String, required: true },
  price:      { type: Number, required: true },
  totalStock: { type: Number, required: true },
  purchased:  { type: Number, default: 0 },
  isPrestige: { type: Boolean, default: false },
  isUnique:   { type: Boolean, default: false },
  buyers:     [{ type: String }],
  createdAt:  { type: Date, default: Date.now },
});

marketRoleSchema.index({ guildId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('MarketRole', marketRoleSchema);
