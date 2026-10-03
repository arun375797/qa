import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import mongoose from 'mongoose'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import Question from './models/Question.js'

const app = express()
const port = process.env.PORT || 5000
const dirname = path.dirname(fileURLToPath(import.meta.url))
const generatedPath = path.resolve(dirname, '../data/questions.generated.json')
const statePath = path.resolve(dirname, '../data/questions.state.json')
const topicsPath = path.resolve(dirname, '../data/topics.json')
let databaseReady = false

app.use(cors())
app.use(express.json())

async function readJson(file, fallback = null) {
  try { return JSON.parse(await readFile(file, 'utf8')) } catch { return fallback }
}

async function loadStore() {
  const generated = await readJson(generatedPath, { meta: {}, questions: [] })
  const state = await readJson(statePath)
  const questions = (state?.questions || generated.questions).map((q) => ({ approved: false, subtopic: '', ...q }))
  const savedTopics = await readJson(topicsPath)
  const names = [...new Set(questions.map((q) => q.topic).filter(Boolean))]
  const topics = savedTopics || names.map((name) => ({ name, subtopics: [] }))
  return { generated, questions, topics }
}

const saveQuestions = (questions) => writeFile(statePath, `${JSON.stringify({ questions }, null, 2)}\n`)
const saveTopics = (topics) => writeFile(topicsPath, `${JSON.stringify(topics, null, 2)}\n`)

app.get('/api/health', (_request, response) => response.json({ ok: true, database: databaseReady }))

app.get('/api/questions', async (_request, response, next) => {
  try {
    const store = await loadStore()
    const stored = databaseReady ? await Question.find().sort({ sourceId: 1 }).lean() : []
    const questions = stored.length
      ? stored.map((q) => ({ id: q.sourceId, text: q.text, topic: q.topic, subtopic: q.subtopic || '', type: q.type, sourceDate: q.sourceDate, approved: Boolean(q.approved) }))
      : store.questions
    response.json({ questions, topics: store.topics, meta: { ...store.generated.meta, total: questions.length, source: stored.length ? 'mongodb' : 'local' } })
  } catch (error) { next(error) }
})

app.patch('/api/questions/:id', async (request, response, next) => {
  try {
    const allowed = ['text', 'topic', 'subtopic', 'approved']
    const updates = Object.fromEntries(Object.entries(request.body).filter(([key]) => allowed.includes(key)))
    if (databaseReady) {
      const question = await Question.findOneAndUpdate({ sourceId: request.params.id }, { $set: updates }, { new: true })
      if (question) return response.json({ question })
    }
    const store = await loadStore()
    const index = store.questions.findIndex((q) => q.id === request.params.id)
    if (index < 0) return response.status(404).json({ message: 'Question not found.' })
    store.questions[index] = { ...store.questions[index], ...updates }
    await saveQuestions(store.questions)
    response.json({ question: store.questions[index] })
  } catch (error) { next(error) }
})

app.delete('/api/questions/:id', async (request, response, next) => {
  try {
    if (databaseReady) await Question.deleteOne({ sourceId: request.params.id })
    const store = await loadStore()
    const questions = store.questions.filter((q) => q.id !== request.params.id)
    if (questions.length === store.questions.length) return response.status(404).json({ message: 'Question not found.' })
    await saveQuestions(questions)
    response.status(204).end()
  } catch (error) { next(error) }
})

app.post('/api/topics', async (request, response, next) => {
  try {
    const name = String(request.body.name || '').trim()
    if (!name) return response.status(400).json({ message: 'Topic name is required.' })
    const store = await loadStore()
    if (!store.topics.some((topic) => topic.name.toLowerCase() === name.toLowerCase())) {
      store.topics.push({ name, subtopics: [] })
      await saveTopics(store.topics)
    }
    response.status(201).json({ topics: store.topics })
  } catch (error) { next(error) }
})

app.post('/api/topics/:topic/subtopics', async (request, response, next) => {
  try {
    const name = String(request.body.name || '').trim()
    if (!name) return response.status(400).json({ message: 'Subtopic name is required.' })
    const store = await loadStore()
    const topic = store.topics.find((item) => item.name === request.params.topic)
    if (!topic) return response.status(404).json({ message: 'Topic not found.' })
    if (!topic.subtopics.some((item) => item.toLowerCase() === name.toLowerCase())) topic.subtopics.push(name)
    await saveTopics(store.topics)
    response.status(201).json({ topics: store.topics })
  } catch (error) { next(error) }
})

app.use((error, _request, response, _next) => {
  console.error(error)
  response.status(500).json({ message: 'Something went wrong while updating the question bank.' })
})

if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => { databaseReady = true; console.log('MongoDB connected') })
    .catch((error) => console.warn(`MongoDB unavailable; using local persistence (${error.message})`))
}

app.listen(port, () => console.log(`API running on http://localhost:${port}`))
