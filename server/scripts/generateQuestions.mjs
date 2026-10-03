import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const sourcePath = process.argv[2]
if (!sourcePath) throw new Error('Pass the source text file path as the first argument.')

const datePattern = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4}$/
const excluded = new Set(['PENDING', 'BUCKET', 'Add Pendings', 'A', 'JavaScript', 'Open Compiler', 'Pending Bucket © 2025 | Developed bySujith V S'])
const headingPattern = /^(pending|theory|practical|feedback|review\s*\d*|previous week pendings):?$/i
const separatorPattern = /^[-_=*•\s]+$/

const topicRules = [
  ['Async JavaScript', /promise|async|await|callback|event loop|microtask|macrotask|timer|settimeout|setinterval|setimmediate|concurren/i],
  ['Functions', /function|closure|currying|hoist|scope|iife|call\b|apply\b|bind\b|parameter|argument|memoization/i],
  ['Arrays', /array|map\b|filter\b|reduce\b|foreach|slice|splice|flat|shift|unshift|find|sort|duplicate/i],
  ['Objects', /object|prototype|class|constructor|inheritance|destructur|freeze|seal|proxy|property|key\b/i],
  ['Language Basics', /javascript|ecmascript|datatype|type |typing|coercion|null|undefined|operator|loop|while|switch|strict|variable|var\b|let\b|const\b/i],
  ['Browser & DOM', /dom|bom|browser|event deleg|event propag|event bubbl|listener|storage|cookie|web api/i],
  ['Strings & Numbers', /string|number|math\.|nan|palindrome|capitalize|reverse a string/i],
  ['Advanced', /generator|weakmap|weakset|garbage|memory|jit|module|security|deboun|throttl|polyfill|symbol/i],
]
const codingPattern = /\b(write|create|find|remove|reverse|print|calculate|convert|implement|return|sum|sort|capitalize|check|generate|program|input|output)\b|=>|console\.log|\[[^\]]*\]|\{[^}]*\}/i

function cleanLine(line) {
  return line.trim().replace(/^[-*•]\s*/, '').replace(/^\d+[.)]\s*/, '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim()
}

function classify(text) {
  return topicRules.find(([, matcher]) => matcher.test(text))?.[0] || 'Core JavaScript'
}

const lines = (await readFile(sourcePath, 'utf8')).replace(/\r/g, '').split('\n')
let sourceDate = ''
const entries = []
for (const rawLine of lines) {
  const text = cleanLine(rawLine)
  if (!text) continue
  if (datePattern.test(text)) { sourceDate = text; continue }
  if (excluded.has(text) || headingPattern.test(text) || separatorPattern.test(text)) continue
  entries.push({ text, sourceDate })
}

const seen = new Set()
const questions = []
for (const entry of entries) {
  if (seen.has(entry.text)) continue
  seen.add(entry.text)
  questions.push({
    id: createHash('sha1').update(entry.text).digest('hex').slice(0, 12),
    text: entry.text,
    topic: classify(entry.text),
    type: codingPattern.test(entry.text) ? 'coding' : 'theory',
    sourceDate: entry.sourceDate,
  })
}

const output = { meta: { originalCount: entries.length, duplicatesRemoved: entries.length - questions.length, total: questions.length }, questions }
const outputPath = path.resolve('server/data/questions.generated.json')
await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`)
console.log(`Generated ${questions.length} unique questions (${entries.length - questions.length} exact duplicates removed).`)
