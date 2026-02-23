const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  question:     { type: String, required: true },
  options:      { type: [String], required: true },   // [A, B, C, D]
  correctIndex: { type: Number, required: true },     // 0–3
}, { _id: false });

const quizSchema = new mongoose.Schema({
  guildId:   { type: String, required: true },
  title:     { type: String, required: true },
  questions: { type: [questionSchema], default: [] },
  createdBy: { type: String, required: true },
}, { timestamps: true });

quizSchema.index({ guildId: 1 });

module.exports = mongoose.model('Quiz', quizSchema);
