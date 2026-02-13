const mongoose = require('mongoose');

const examinationSchema = new mongoose.Schema({
  guildId:      { type: String, required: true },
  examinerId:   { type: String, required: true },
  examineeId:   { type: String, required: true },
  outcome:      { type: String, enum: ['bestanden', 'mittle_ding', 'verkackt'], required: true },
  notes:        { type: String, default: null },
  coinsAwarded: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Examination', examinationSchema);
