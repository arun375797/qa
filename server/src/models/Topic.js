import mongoose from 'mongoose'

const topicSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, index: true },
  subtopics: { type: [String], default: [] },
}, { timestamps: true })

export default mongoose.model('Topic', topicSchema)
