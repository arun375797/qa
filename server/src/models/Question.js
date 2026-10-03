import mongoose from 'mongoose'

const questionSchema = new mongoose.Schema({
  sourceId: { type: String, required: true, unique: true, index: true },
  text: { type: String, required: true },
  topic: { type: String, required: true, index: true },
  subtopic: { type: String, default: '', index: true },
  type: { type: String, enum: ['theory', 'practical', 'coding'], default: 'theory', index: true },
  sourceDate: String,
  approved: { type: Boolean, default: false, index: true },
}, { timestamps: true })

export default mongoose.model('Question', questionSchema)
