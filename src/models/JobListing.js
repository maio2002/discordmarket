const mongoose = require('mongoose');

const jobListingSchema = new mongoose.Schema({
  guildId:     { type: String, required: true },
  title:       { type: String, required: true },
  description: { type: String, required: true },
  roleId:      { type: String, default: null },
  salary:      { type: Number, required: true },
  isOpen:      { type: Boolean, default: true },
  createdAt:   { type: Date, default: Date.now },
});

jobListingSchema.index({ guildId: 1, isOpen: 1 });

module.exports = mongoose.model('JobListing', jobListingSchema);
