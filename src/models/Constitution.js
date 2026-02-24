const mongoose = require('mongoose');

const constitutionSchema = new mongoose.Schema({
  guildId:  { type: String, required: true, unique: true },
  content:  { type: String, default: '*(Noch keine Verfassung geschrieben.)*' },
  version:  { type: Number, default: 0 },
  editedBy: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Constitution', constitutionSchema);
