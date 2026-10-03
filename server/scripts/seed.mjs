import 'dotenv/config'
import mongoose from 'mongoose'
import { readFile } from 'node:fs/promises'
import Question from '../src/models/Question.js'
import Topic from '../src/models/Topic.js'

if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in server/.env before seeding.')
const data = JSON.parse(await readFile(new URL('../data/questions.generated.json', import.meta.url), 'utf8'))
const topics = JSON.parse(await readFile(new URL('../data/topics.json', import.meta.url), 'utf8'))
await mongoose.connect(process.env.MONGODB_URI)
await Promise.all([
  Question.bulkWrite(data.questions.map((question) => ({
    updateOne: {
      filter: { sourceId: question.id },
      update: { $set: { sourceId: question.id, text: question.text, topic: question.topic, subtopic: question.subtopic || '', type: question.type === 'coding' ? 'practical' : question.type, sourceDate: question.sourceDate, approved: Boolean(question.approved) } },
      upsert: true,
    },
  }))),
  Topic.bulkWrite(topics.map((topic) => ({
    updateOne: {
      filter: { name: topic.name },
      update: { $set: { subtopics: topic.subtopics || [] } },
      upsert: true,
    },
  }))),
])
console.log(`Seeded ${data.questions.length} questions and ${topics.length} topics.`)
await mongoose.disconnect()
