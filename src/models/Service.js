const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  guildId:     { type: String, required: true },
  name:        { type: String, required: true },
  description: { type: String, required: true },
  price:       { type: Number, required: true },
  providerId:  { type: String, required: true },
  isActive:    { type: Boolean, default: true },
  createdAt:   { type: Date, default: Date.now },
});

serviceSchema.index({ guildId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Service', serviceSchema);
