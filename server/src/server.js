import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import mongoose from 'mongoose'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import Question from './models/Question.js'
import Topic from './models/Topic.js'

const app = express()
const port = process.env.PORT || 5000
const dirname = path.dirname(fileURLToPath(import.meta.url))
const generatedPath = path.resolve(dirname, '../data/questions.generated.json')
const statePath = path.resolve(dirname, '../data/questions.state.json')
const topicsPath = path.resolve(dirname, '../data/topics.json')
let databaseReady = false

const databaseConnection = process.env.MONGODB_URI
  ? mongoose.connect(process.env.MONGODB_URI)
    .then(() => { databaseReady = true; console.log('MongoDB connected') })
    .catch((error) => console.warn(`MongoDB unavailable; using local persistence (${error.message})`))
  : Promise.resolve()

app.use(cors())
app.use(express.json())
app.use(async (request, response, next) => {
  await databaseConnection
  if (process.env.VERCEL && !databaseReady && request.method !== 'GET') {
    return response.status(503).json({ message: 'MongoDB is required for changes on Vercel. Add MONGODB_URI to the project environment variables.' })
  }
  next()
})

async function readJson(file, fallback = null) {
  try { return JSON.parse(await readFile(file, 'utf8')) } catch { return fallback }
}

async function loadStore() {
  const generated = await readJson(generatedPath, { meta: {}, questions: [] })
  const state = await readJson(statePath)
  const questions = (state?.questions || generated.questions).map((q) => ({
    approved: false,
    subtopic: '',
    ...q,
    type: q.type === 'coding' ? 'practical' : (q.type || 'theory'),
  }))
  const savedTopics = await readJson(topicsPath)
  const names = [...new Set(questions.map((q) => q.topic).filter(Boolean))]
  const storedTopics = databaseReady ? await Topic.find().sort({ createdAt: 1, name: 1 }).lean() : []
  const topics = storedTopics.length
    ? storedTopics.map(({ name, subtopics }) => ({ name, subtopics }))
    : (savedTopics || names.map((name) => ({ name, subtopics: [] })))
  return { generated, questions, topics }
}

const saveQuestions = (questions) => writeFile(statePath, `${JSON.stringify({ questions }, null, 2)}\n`)
async function saveTopics(topics) {
  if (!databaseReady) return writeFile(topicsPath, `${JSON.stringify(topics, null, 2)}\n`)
  await Topic.bulkWrite(topics.map((topic) => ({
    updateOne: {
      filter: { name: topic.name },
      update: { $set: { subtopics: topic.subtopics } },
      upsert: true,
    },
  })))
  await Topic.deleteMany({ name: { $nin: topics.map((topic) => topic.name) } })
}

app.get('/api/health', (_request, response) => response.json({ ok: true, database: databaseReady }))

app.get('/api/questions', async (_request, response, next) => {
  try {
    const store = await loadStore()
    const stored = databaseReady ? await Question.find().sort({ sourceId: 1 }).lean() : []
    const questions = stored.length
      ? stored.map((q) => ({ id: q.sourceId, text: q.text, topic: q.topic, subtopic: q.subtopic || '', type: q.type === 'coding' ? 'practical' : q.type, sourceDate: q.sourceDate, approved: Boolean(q.approved) }))
      : store.questions
    response.json({ questions, topics: store.topics, meta: { ...store.generated.meta, total: questions.length, source: stored.length ? 'mongodb' : 'local' } })
  } catch (error) { next(error) }
})

app.patch('/api/questions/:id', async (request, response, next) => {
  try {
    const allowed = ['text', 'topic', 'subtopic', 'type', 'approved']
    const updates = Object.fromEntries(Object.entries(request.body).filter(([key]) => allowed.includes(key)))
    if (updates.type && !['theory', 'practical'].includes(updates.type)) {
      return response.status(400).json({ message: 'Type must be theory or practical.' })
    }
    if (databaseReady) {
      const store = await loadStore()
      const source = store.questions.find((question) => question.id === request.params.id)
      if (!source) return response.status(404).json({ message: 'Question not found.' })
      const question = await Question.findOneAndUpdate(
        { sourceId: request.params.id },
        { $set: { sourceId: source.id, text: source.text, topic: source.topic, subtopic: source.subtopic || '', type: source.type, sourceDate: source.sourceDate, approved: Boolean(source.approved), ...updates } },
        { new: true, upsert: true },
      )
      return response.json({ question })
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
    if (databaseReady) {
      const result = await Question.deleteOne({ sourceId: request.params.id })
      return result.deletedCount ? response.status(204).end() : response.status(404).json({ message: 'Question not found.' })
    }
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

app.patch('/api/topics/:topic', async (request, response, next) => {
  try {
    const currentName = request.params.topic
    const name = String(request.body.name || '').trim()
    if (!name) return response.status(400).json({ message: 'Topic name is required.' })
    const store = await loadStore()
    const topic = store.topics.find((item) => item.name === currentName)
    if (!topic) return response.status(404).json({ message: 'Topic not found.' })
    if (store.topics.some((item) => item.name !== currentName && item.name.toLowerCase() === name.toLowerCase())) return response.status(409).json({ message: 'That topic already exists.' })
    topic.name = name
    const questions = store.questions.map((question) => question.topic === currentName ? { ...question, topic: name } : question)
    await Promise.all([saveTopics(store.topics), databaseReady ? Question.updateMany({ topic: currentName }, { $set: { topic: name } }) : saveQuestions(questions)])
    response.json({ topics: store.topics })
  } catch (error) { next(error) }
})

app.delete('/api/topics/:topic', async (request, response, next) => {
  try {
    const name = request.params.topic
    const store = await loadStore()
    if (!store.topics.some((topic) => topic.name === name)) return response.status(404).json({ message: 'Topic not found.' })
    const topics = store.topics.filter((topic) => topic.name !== name)
    if (!topics.some((topic) => topic.name === 'Uncategorized')) topics.push({ name: 'Uncategorized', subtopics: [] })
    const questions = store.questions.map((question) => question.topic === name ? { ...question, topic: 'Uncategorized', subtopic: '' } : question)
    await Promise.all([saveTopics(topics), databaseReady ? Question.updateMany({ topic: name }, { $set: { topic: 'Uncategorized', subtopic: '' } }) : saveQuestions(questions)])
    response.json({ topics })
  } catch (error) { next(error) }
})

app.patch('/api/topics/:topic/subtopics/:subtopic', async (request, response, next) => {
  try {
    const topicName = request.params.topic
    const currentName = request.params.subtopic
    const name = String(request.body.name || '').trim()
    if (!name) return response.status(400).json({ message: 'Subtopic name is required.' })
    const store = await loadStore()
    const topic = store.topics.find((item) => item.name === topicName)
    if (!topic || !topic.subtopics.includes(currentName)) return response.status(404).json({ message: 'Subtopic not found.' })
    if (topic.subtopics.some((item) => item !== currentName && item.toLowerCase() === name.toLowerCase())) return response.status(409).json({ message: 'That subtopic already exists.' })
    topic.subtopics = topic.subtopics.map((item) => item === currentName ? name : item)
    const questions = store.questions.map((question) => question.topic === topicName && question.subtopic === currentName ? { ...question, subtopic: name } : question)
    await Promise.all([saveTopics(store.topics), databaseReady ? Question.updateMany({ topic: topicName, subtopic: currentName }, { $set: { subtopic: name } }) : saveQuestions(questions)])
    response.json({ topics: store.topics })
  } catch (error) { next(error) }
})

app.delete('/api/topics/:topic/subtopics/:subtopic', async (request, response, next) => {
  try {
    const topicName = request.params.topic
    const subtopicName = request.params.subtopic
    const store = await loadStore()
    const topic = store.topics.find((item) => item.name === topicName)
    if (!topic || !topic.subtopics.includes(subtopicName)) return response.status(404).json({ message: 'Subtopic not found.' })
    topic.subtopics = topic.subtopics.filter((item) => item !== subtopicName)
    const questions = store.questions.map((question) => question.topic === topicName && question.subtopic === subtopicName ? { ...question, subtopic: '' } : question)
    await Promise.all([saveTopics(store.topics), databaseReady ? Question.updateMany({ topic: topicName, subtopic: subtopicName }, { $set: { subtopic: '' } }) : saveQuestions(questions)])
    response.json({ topics: store.topics })
  } catch (error) { next(error) }
})

app.use((error, _request, response, _next) => {
  console.error(error)
  response.status(500).json({ message: 'Something went wrong while updating the question bank.' })
})

if (!process.env.VERCEL) app.listen(port, () => console.log(`API running on http://localhost:${port}`))

export default app
