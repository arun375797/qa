import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Edit3, FolderInput, LayoutGrid, Minus, Plus, Save, Search, Tags, Trash2, X } from 'lucide-react'

const PAGE_SIZE = 50

function CountBadge({ count }) {
  return <span className="absolute -right-2 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#ef4444] px-1 mono text-[7px] font-bold leading-none text-white shadow-[0_2px_6px_rgba(239,68,68,.35)]">{count > 99 ? '99+' : count}</span>
}

function App() {
  const [questions, setQuestions] = useState([])
  const [topics, setTopics] = useState([])
  const [view, setView] = useState('organise')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [editingTopic, setEditingTopic] = useState(null)
  const [editTopicName, setEditTopicName] = useState('')
  const [editingSubtopic, setEditingSubtopic] = useState(null)
  const [editSubtopicName, setEditSubtopicName] = useState('')
  const [newTopic, setNewTopic] = useState('')
  const [newSubtopic, setNewSubtopic] = useState('')
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [activeTopic, setActiveTopic] = useState(() => localStorage.getItem('vault-topic') || '')
  const [activeSubtopic, setActiveSubtopic] = useState(() => localStorage.getItem('vault-subtopic') || '')
  const [mainTopic, setMainTopic] = useState('')
  const [mainSubtopic, setMainSubtopic] = useState('')

  useEffect(() => {
    fetch('/api/questions').then((response) => response.json()).then((data) => {
      setQuestions(data.questions)
      setTopics(data.topics)
      const saved = localStorage.getItem('vault-topic')
      if (!saved || !data.topics.some((topic) => topic.name === saved)) setActiveTopic(data.topics[0]?.name || '')
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    localStorage.setItem('vault-topic', activeTopic)
    localStorage.setItem('vault-subtopic', activeSubtopic)
  }, [activeTopic, activeSubtopic])

  const headerTopic = view === 'main' ? mainTopic : activeTopic
  const headerSubtopic = view === 'main' ? mainSubtopic : activeSubtopic
  const selectedTopic = topics.find((topic) => topic.name === headerTopic)
  const availableSubtopics = selectedTopic?.subtopics || []
  const approved = questions.filter((question) => question.approved)
  const topicCounts = useMemo(() => {
    const counts = new Map()
    for (const question of questions) {
      if (!question.approved) continue
      counts.set(question.topic, (counts.get(question.topic) || 0) + 1)
    }
    return counts
  }, [questions])
  const selectedTopicQuestions = useMemo(() => questions.filter((question) => {
    if (!question.approved) return false
    return !headerTopic || question.topic === headerTopic
  }), [questions, headerTopic])
  const subtopicCounts = useMemo(() => {
    const counts = new Map()
    for (const question of selectedTopicQuestions) counts.set(question.subtopic || '', (counts.get(question.subtopic || '') || 0) + 1)
    return counts
  }, [selectedTopicQuestions])
  const visible = useMemo(() => {
    const filtered = questions.filter((question) => {
    if (view === 'main' && !question.approved) return false
    const searchTerms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (!searchTerms.every((term) => question.text.toLowerCase().includes(term))) return false
    if (typeFilter === 'theory' && question.type !== 'theory') return false
    if (typeFilter === 'practical' && question.type !== 'practical' && question.type !== 'coding') return false
    if (view === 'main' && mainTopic && question.topic !== mainTopic) return false
    if (view === 'main' && mainSubtopic && question.subtopic !== mainSubtopic) return false
    return true
    })

    if (view !== 'organise') return filtered

    return [
      ...filtered.filter((question) => !question.approved),
      ...filtered.filter((question) => question.approved),
    ]
  }, [questions, query, typeFilter, view, mainTopic, mainSubtopic])
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const displayed = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  function flash(message) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 1800)
  }

  async function updateQuestion(id, updates) {
    setQuestions((current) => current.map((question) => question.id === id ? { ...question, ...updates } : question))
    const response = await fetch(`/api/questions/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) })
    if (!response.ok) throw new Error('Update failed')
  }

  async function approveQuestion(question) {
    if (!activeTopic) return flash('Choose a topic first')
    await updateQuestion(question.id, { approved: true, topic: activeTopic, subtopic: activeSubtopic })
    flash(`Added to ${activeTopic}${activeSubtopic ? ` · ${activeSubtopic}` : ''}`)
  }

  async function moveToOrganise(id) {
    await updateQuestion(id, { approved: false })
    flash('Moved to Organise')
  }

  async function removeQuestion(id) {
    setQuestions((current) => current.filter((question) => question.id !== id))
    await fetch(`/api/questions/${id}`, { method: 'DELETE' })
    flash('Question deleted')
  }

  async function saveEdit(id) {
    if (!editText.trim()) return
    await updateQuestion(id, { text: editText.trim() })
    setEditingId(null)
    flash('Question updated')
  }

  async function createTopic(event) {
    event.preventDefault()
    const name = newTopic.trim()
    if (!name) return
    const response = await fetch('/api/topics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
    const data = await response.json()
    setTopics(data.topics); setActiveTopic(name); setActiveSubtopic(''); setNewTopic('')
  }

  async function createSubtopic(event) {
    event.preventDefault()
    const name = newSubtopic.trim()
    if (!name || !activeTopic) return
    const response = await fetch(`/api/topics/${encodeURIComponent(activeTopic)}/subtopics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
    const data = await response.json()
    setTopics(data.topics); setActiveSubtopic(name); setNewSubtopic('')
  }

  async function renameTopic(currentName) {
    const name = editTopicName.trim()
    if (!name) return
    const response = await fetch(`/api/topics/${encodeURIComponent(currentName)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
    const data = await response.json()
    if (!response.ok) return flash(data.message || 'Could not rename topic')
    setTopics(data.topics)
    setQuestions((current) => current.map((question) => question.topic === currentName ? { ...question, topic: name } : question))
    if (activeTopic === currentName) setActiveTopic(name)
    setEditingTopic(null)
    flash('Topic renamed')
  }

  async function deleteTopic(name) {
    const response = await fetch(`/api/topics/${encodeURIComponent(name)}`, { method: 'DELETE' })
    const data = await response.json()
    if (!response.ok) return flash(data.message || 'Could not delete topic')
    setTopics(data.topics)
    setQuestions((current) => current.map((question) => question.topic === name ? { ...question, topic: 'Uncategorized', subtopic: '' } : question))
    if (activeTopic === name) { setActiveTopic('Uncategorized'); setActiveSubtopic('') }
    flash('Topic deleted · questions moved to Uncategorized')
  }

  async function renameSubtopic(topicName, currentName) {
    const name = editSubtopicName.trim()
    if (!name) return
    const response = await fetch(`/api/topics/${encodeURIComponent(topicName)}/subtopics/${encodeURIComponent(currentName)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
    const data = await response.json()
    if (!response.ok) return flash(data.message || 'Could not rename subtopic')
    setTopics(data.topics)
    setQuestions((current) => current.map((question) => question.topic === topicName && question.subtopic === currentName ? { ...question, subtopic: name } : question))
    if (activeTopic === topicName && activeSubtopic === currentName) setActiveSubtopic(name)
    setEditingSubtopic(null)
    flash('Subtopic renamed')
  }

  async function deleteSubtopic(topicName, subtopicName) {
    const response = await fetch(`/api/topics/${encodeURIComponent(topicName)}/subtopics/${encodeURIComponent(subtopicName)}`, { method: 'DELETE' })
    const data = await response.json()
    if (!response.ok) return flash(data.message || 'Could not delete subtopic')
    setTopics(data.topics)
    setQuestions((current) => current.map((question) => question.topic === topicName && question.subtopic === subtopicName ? { ...question, subtopic: '' } : question))
    if (activeTopic === topicName && activeSubtopic === subtopicName) setActiveSubtopic('')
    flash('Subtopic deleted')
  }

  function switchView(next) {
    setView(next); setPage(1); setQuery('')
    if (next === 'main') { setMainTopic(''); setMainSubtopic('') }
  }
  function selectTopic(name) { setActiveTopic(name); setActiveSubtopic(''); setPage(1) }
  function selectHeaderTopic(name) {
    if (view === 'main') { setMainTopic(name); setMainSubtopic(''); setPage(1) }
    else selectTopic(name)
  }
  function selectHeaderSubtopic(name) {
    if (view === 'main') setMainSubtopic(name)
    else setActiveSubtopic(name)
    setPage(1)
  }

  return (
    <div className="min-h-screen bg-[#f5f5f3] text-[#191918]">
      {notice && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#191918] px-5 py-3 text-sm font-semibold text-white shadow-2xl">{notice}</div>}
      <div className="flex min-h-screen">
        <aside className="sticky top-0 z-40 hidden h-screen shrink-0 flex-col border-r border-[#e6e6e2] bg-white transition-[width] duration-300 md:flex" style={{ width: sidebarOpen ? 280 : 84 }}>
          <div className={`flex h-20 shrink-0 items-center border-b border-[#eeeeea] ${sidebarOpen ? 'justify-between px-5' : 'justify-center'}`}>
            <div className="flex items-center gap-3 overflow-hidden"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#625bf6] text-sm font-black text-white shadow-[0_8px_24px_rgba(98,91,246,.28)]">JS</span>{sidebarOpen && <div className="whitespace-nowrap"><p className="text-sm font-extrabold tracking-[-.02em]">Interview Vault</p><p className="mono text-[8px] uppercase tracking-[.2em] text-black/35">Workspace</p></div>}</div>
            {sidebarOpen && <button onClick={() => setSidebarOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-black/35 hover:bg-black/5 hover:text-black" aria-label="Collapse sidebar"><ChevronsLeft size={17}/></button>}
          </div>

          {!sidebarOpen ? <div className="flex flex-1 flex-col items-center gap-3 py-5"><button onClick={() => setSidebarOpen(true)} className="grid h-9 w-9 place-items-center rounded-lg text-black/40 hover:bg-black/5" aria-label="Expand sidebar"><ChevronsRight size={18}/></button><button onClick={() => switchView('main')} className={`grid h-11 w-11 place-items-center rounded-xl ${view === 'main' ? 'bg-[#625bf6] text-white' : 'text-black/40 hover:bg-black/5'}`} title="Main"><LayoutGrid size={19}/></button><button onClick={() => switchView('organise')} className={`grid h-11 w-11 place-items-center rounded-xl ${view === 'organise' ? 'bg-[#625bf6] text-white' : 'text-black/40 hover:bg-black/5'}`} title="Organise"><FolderInput size={19}/></button><button onClick={() => switchView('topics')} className={`grid h-11 w-11 place-items-center rounded-xl ${view === 'topics' ? 'bg-[#625bf6] text-white' : 'text-black/40 hover:bg-black/5'}`} title="Topics"><Tags size={19}/></button></div> : <>
            <nav className="space-y-1.5 p-4">
              <p className="mono mb-3 px-3 text-[9px] uppercase tracking-[.16em] text-black/35">Workspace</p>
              <button onClick={() => switchView('main')} className={`flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-sm font-bold transition ${view === 'main' ? 'bg-[#eeedff] text-[#4c45d6]' : 'text-black/55 hover:bg-[#f5f5f3] hover:text-black'}`}><span className="flex items-center gap-3"><LayoutGrid size={18}/>Main questions</span><span className={`rounded-md px-2 py-1 mono text-[9px] ${view === 'main' ? 'bg-white text-[#4c45d6]' : 'bg-black/5 text-black/35'}`}>{approved.length}</span></button>
              <button onClick={() => switchView('organise')} className={`flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-sm font-bold transition ${view === 'organise' ? 'bg-[#eeedff] text-[#4c45d6]' : 'text-black/55 hover:bg-[#f5f5f3] hover:text-black'}`}><span className="flex items-center gap-3"><FolderInput size={18}/>Organise</span><span className={`rounded-md px-2 py-1 mono text-[9px] ${view === 'organise' ? 'bg-white text-[#4c45d6]' : 'bg-black/5 text-black/35'}`}>{questions.length}</span></button>
              <button onClick={() => switchView('topics')} className={`flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-sm font-bold transition ${view === 'topics' ? 'bg-[#eeedff] text-[#4c45d6]' : 'text-black/55 hover:bg-[#f5f5f3] hover:text-black'}`}><span className="flex items-center gap-3"><Tags size={18}/>Topics</span><span className={`rounded-md px-2 py-1 mono text-[9px] ${view === 'topics' ? 'bg-white text-[#4c45d6]' : 'bg-black/5 text-black/35'}`}>{topics.length}</span></button>
            </nav>

            <div className="mx-4 rounded-2xl bg-[#191918] p-4 text-white">
              <div className="flex items-center justify-between"><span className="mono text-[9px] uppercase tracking-[.16em] text-white/45">Curated</span><span className="text-lg font-extrabold">{questions.length ? Math.round(approved.length / questions.length * 100) : 0}%</span></div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#c8ff4d] transition-all" style={{ width: `${questions.length ? approved.length / questions.length * 100 : 0}%` }}/></div>
              <p className="mt-3 text-[11px] text-white/50">{approved.length} of {questions.length} questions ready</p>
            </div>

            <div className="mt-auto p-4"><div className="rounded-xl border border-[#e8e8e3] bg-[#fafaf8] p-3"><p className="text-xs font-bold">Keep it organised</p><p className="mt-1 text-[10px] leading-4 text-black/40">Manage topics and subtopics from the Topics section.</p></div></div>
          </>}
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-[#e3e3df] bg-[#f5f5f3]/95 backdrop-blur-xl">
            <div className="border-b border-[#e7e7e3] p-3 md:hidden"><div className="grid grid-cols-3 rounded-xl bg-[#e9e9e5] p-1"><button onClick={() => switchView('main')} className={`rounded-lg py-2 text-xs font-bold ${view === 'main' ? 'bg-white text-[#514bd4] shadow-sm' : 'text-black/40'}`}>Main · {approved.length}</button><button onClick={() => switchView('organise')} className={`rounded-lg py-2 text-xs font-bold ${view === 'organise' ? 'bg-white text-[#514bd4] shadow-sm' : 'text-black/40'}`}>Organise</button><button onClick={() => switchView('topics')} className={`rounded-lg py-2 text-xs font-bold ${view === 'topics' ? 'bg-white text-[#514bd4] shadow-sm' : 'text-black/40'}`}>Topics · {topics.length}</button></div></div>
            <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-5 lg:px-8">
              <div className="flex items-center gap-3"><button onClick={() => setSidebarOpen(!sidebarOpen)} className="hidden h-9 w-9 place-items-center rounded-lg border border-[#deded9] bg-white text-black/45 hover:text-black md:grid" aria-label="Toggle sidebar">{sidebarOpen ? <ChevronsLeft size={17}/> : <ChevronsRight size={17}/>}</button><div><p className="text-xl font-extrabold tracking-[-.03em]">{view === 'main' ? 'Main questions' : view === 'organise' ? 'Organise your questions' : 'Topics & subtopics'}</p><p className="mt-0.5 text-xs text-black/40">{view === 'main' ? 'Your approved interview study set' : view === 'organise' ? 'Clean, classify and approve your question inbox' : 'View and build your interview syllabus'}</p></div></div>
              {view !== 'topics' && <div className="hidden items-center gap-2 rounded-full border border-[#e1e1dc] bg-white px-3 py-2 text-[11px] text-black/40 sm:flex"><span className="h-2 w-2 rounded-full bg-[#8dd72c]"/>{view === 'main' ? 'Viewing' : 'Assigning to'} <strong className="text-black/70">{view === 'main' ? (mainTopic || 'All topics') : (activeTopic || 'Choose a topic')}{headerSubtopic ? ` / ${headerSubtopic}` : ''}</strong></div>}
            </div>
            {view !== 'topics' && <div className="border-t border-[#e7e7e3] bg-white/80">
              <div className="mx-auto max-w-[1500px] px-5 lg:px-8">
                <div className="flex min-h-14 flex-wrap items-center gap-x-4 border-b border-[#ecece8]">
                  <span className="shrink-0 pr-2 mono text-[8px] uppercase tracking-[.18em] text-black/30">Topics</span>
                  {view === 'main' && <button onClick={() => selectHeaderTopic('')} className={`relative h-14 shrink-0 px-1 pr-2 text-xs font-bold transition ${!mainTopic ? 'text-[#514bd4]' : 'text-black/40 hover:text-black/70'}`}>All topics<CountBadge count={approved.length}/>{!mainTopic && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#625bf6]"/>}</button>}
                  {topics.map((topic) => <button key={topic.name} onClick={() => selectHeaderTopic(topic.name)} className={`relative h-14 shrink-0 px-1 pr-2 text-xs font-bold transition ${headerTopic === topic.name ? 'text-[#514bd4]' : 'text-black/40 hover:text-black/70'}`}>{topic.name}<CountBadge count={topicCounts.get(topic.name) || 0}/>{headerTopic === topic.name && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#625bf6]"/>}</button>)}
                  <button onClick={() => switchView('topics')} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#deded9] text-black/40 hover:border-[#625bf6] hover:text-[#625bf6] md:hidden" aria-label="Manage topics"><Plus size={14}/></button>
                </div>
                <div className="flex min-h-12 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <span className="sticky left-0 z-10 shrink-0 bg-white/90 pr-2 mono text-[8px] uppercase tracking-[.18em] text-black/30">Subtopics</span>
                  <button onClick={() => selectHeaderSubtopic('')} className={`relative mr-1 shrink-0 rounded-full px-3 py-1.5 pr-5 text-[11px] font-semibold transition ${!headerSubtopic ? 'bg-[#191918] text-white' : 'bg-[#f1f1ee] text-black/45 hover:text-black'}`}>{view === 'main' ? 'All subtopics' : 'No subtopic'}<CountBadge count={view === 'main' ? selectedTopicQuestions.length : (subtopicCounts.get('') || 0)}/></button>
                  {availableSubtopics.map((subtopic) => <button key={subtopic} onClick={() => selectHeaderSubtopic(subtopic)} className={`relative mr-1 shrink-0 rounded-full px-3 py-1.5 pr-5 text-[11px] font-semibold transition ${headerSubtopic === subtopic ? 'bg-[#625bf6] text-white' : 'bg-[#f1f1ee] text-black/45 hover:text-black'}`}>{subtopic}<CountBadge count={subtopicCounts.get(subtopic) || 0}/></button>)}
                  {headerTopic && availableSubtopics.length === 0 && <span className="text-[11px] text-black/30">No subtopics created for {headerTopic}</span>}
                </div>
              </div>
            </div>}
          </header>

          <section className="mx-auto max-w-[1500px] px-5 py-7 lg:px-8 lg:py-9">
            {view === 'topics' ? <div>
              <div className="grid gap-5 rounded-3xl bg-[#191918] p-6 text-white md:grid-cols-[1fr_auto] md:items-end md:p-8">
                <div><p className="mono text-[9px] uppercase tracking-[.18em] text-[#aaa5ff]">Syllabus builder</p><h1 className="mt-2 text-3xl font-extrabold tracking-[-.045em]">All topics, one clear structure.</h1><p className="mt-2 max-w-xl text-sm leading-6 text-white/45">Open a topic to see its subtopics, question totals, and add a new subtopic directly inside it.</p></div>
                <form onSubmit={createTopic} className="flex gap-2 rounded-2xl bg-white/10 p-2"><input value={newTopic} onChange={(event) => setNewTopic(event.target.value)} placeholder="New topic name" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#aaa5ff] md:w-56"/><button className="flex shrink-0 items-center gap-2 rounded-xl bg-[#c8ff4d] px-4 text-xs font-extrabold text-black"><Plus size={15}/>Create topic</button></form>
              </div>

              <div className="mb-5 mt-9 flex items-end justify-between"><div><p className="mono text-[9px] uppercase tracking-[.18em] text-[#625bf6]">Topic directory</p><h2 className="mt-1 text-3xl font-extrabold tracking-[-.04em]">{topics.length} <span className="font-medium text-black/25">topics</span></h2></div><p className="hidden text-xs text-black/35 sm:block">Select a card to manage its subtopics</p></div>

              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{topics.map((topic, topicIndex) => {
                const topicQuestions = questions.filter((question) => question.topic === topic.name && question.approved)
                const readyCount = topicQuestions.length
                const isActive = activeTopic === topic.name
                return <article key={topic.name} className={`overflow-hidden rounded-2xl border bg-white transition ${isActive ? 'border-[#625bf6] shadow-[0_12px_35px_rgba(98,91,246,.12)]' : 'border-[#e2e2dd] hover:border-black/20'}`}>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4"><span className={`grid h-10 w-10 place-items-center rounded-xl mono text-xs font-bold ${isActive ? 'bg-[#625bf6] text-white' : 'bg-[#f0efff] text-[#514bd4]'}`}>{String(topicIndex + 1).padStart(2, '0')}</span><span className="rounded-full bg-[#f4f4f1] px-2.5 py-1 mono text-[8px] uppercase tracking-wider text-black/40">{readyCount} assigned</span></div>
                    {editingTopic === topic.name ? <form onSubmit={(event) => { event.preventDefault(); renameTopic(topic.name) }} className="mt-5 flex gap-2"><input autoFocus value={editTopicName} onChange={(event) => setEditTopicName(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-[#625bf6] px-3 py-2 text-sm font-bold outline-none"/><button className="grid h-9 w-9 place-items-center rounded-lg bg-[#625bf6] text-white" aria-label="Save topic name"><Save size={14}/></button><button type="button" onClick={() => setEditingTopic(null)} className="grid h-9 w-9 place-items-center rounded-lg border border-[#deded9]" aria-label="Cancel topic edit"><X size={14}/></button></form> : <div className="mt-5 flex items-start justify-between gap-3"><button onClick={() => selectTopic(topic.name)} className="min-w-0 text-left"><h3 className="truncate text-lg font-extrabold tracking-[-.025em]">{topic.name}</h3><p className="mt-1 text-xs text-black/35">{topic.subtopics.length ? `${topic.subtopics.length} subtopic${topic.subtopics.length === 1 ? '' : 's'}` : 'No subtopics yet'}</p></button><div className="flex shrink-0 gap-1"><button onClick={() => { setEditingTopic(topic.name); setEditTopicName(topic.name) }} className="grid h-8 w-8 place-items-center rounded-lg border border-[#deded9] text-black/35 hover:border-[#625bf6] hover:text-[#625bf6]" title="Edit topic" aria-label={`Edit ${topic.name}`}><Edit3 size={13}/></button><button onClick={() => deleteTopic(topic.name)} className="grid h-8 w-8 place-items-center rounded-lg border border-[#deded9] text-black/35 hover:border-red-200 hover:bg-red-50 hover:text-red-600" title="Delete topic" aria-label={`Delete ${topic.name}`}><Trash2 size={13}/></button></div></div>}
                  </div>
                  <div className="border-t border-[#eeeeea] bg-[#fafaf8] p-4">
                    <p className="mb-2 mono text-[8px] uppercase tracking-[.16em] text-black/30">Subtopics</p>
                    <div className="flex min-h-7 flex-wrap gap-2">{topic.subtopics.length ? topic.subtopics.map((subtopic) => {
                      const editKey = `${topic.name}::${subtopic}`
                      return editingSubtopic === editKey ? <form key={subtopic} onSubmit={(event) => { event.preventDefault(); renameSubtopic(topic.name, subtopic) }} className="flex items-center gap-1"><input autoFocus value={editSubtopicName} onChange={(event) => setEditSubtopicName(event.target.value)} className="w-36 rounded-lg border border-[#625bf6] bg-white px-2.5 py-1.5 text-[11px] outline-none"/><button className="grid h-7 w-7 place-items-center rounded-lg bg-[#625bf6] text-white" aria-label="Save subtopic name"><Save size={11}/></button><button type="button" onClick={() => setEditingSubtopic(null)} className="grid h-7 w-7 place-items-center rounded-lg border border-[#deded9] bg-white" aria-label="Cancel subtopic edit"><X size={11}/></button></form> : <div key={subtopic} className={`flex items-center overflow-hidden rounded-full border ${isActive && activeSubtopic === subtopic ? 'border-[#625bf6] bg-[#625bf6] text-white' : 'border-[#dfdfda] bg-white text-black/50'}`}><button onClick={() => { selectTopic(topic.name); setActiveSubtopic(subtopic) }} className="px-3 py-1.5 text-[10px] font-semibold">{subtopic}</button><button onClick={() => { setEditingSubtopic(editKey); setEditSubtopicName(subtopic) }} className="grid h-7 w-7 place-items-center border-l border-current/15 opacity-60 hover:opacity-100" title="Edit subtopic" aria-label={`Edit ${subtopic}`}><Edit3 size={10}/></button><button onClick={() => deleteSubtopic(topic.name, subtopic)} className="grid h-7 w-7 place-items-center border-l border-current/15 opacity-60 hover:bg-red-50 hover:text-red-600 hover:opacity-100" title="Delete subtopic" aria-label={`Delete ${subtopic}`}><Trash2 size={10}/></button></div>
                    }) : <span className="text-[11px] text-black/30">Add the first subtopic below.</span>}</div>
                    {isActive && <form onSubmit={createSubtopic} className="mt-4 flex gap-2"><input value={newSubtopic} onChange={(event) => setNewSubtopic(event.target.value)} placeholder={`New subtopic for ${topic.name}`} className="min-w-0 flex-1 rounded-lg border border-[#deded9] bg-white px-3 py-2 text-xs outline-none focus:border-[#625bf6]"/><button className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#191918] text-white" aria-label={`Add subtopic to ${topic.name}`}><Plus size={14}/></button></form>}
                  </div>
                </article>
              })}</div>
            </div> : <>
            <div className="rounded-2xl border border-[#e2e2dd] bg-white p-3 shadow-[0_10px_35px_rgba(20,20,20,.035)]">
              <div className="flex flex-col gap-3 xl:flex-row">
                <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-[#f5f5f3] px-4 py-3"><Search size={17} className="text-black/30"/><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Search the question bank" className="w-full bg-transparent text-sm outline-none placeholder:text-black/30"/>{query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={15}/></button>}</label>
                <div className="flex shrink-0 rounded-xl bg-[#f1f1ee] p-1" aria-label="Question type filter">{[['all', 'All'], ['theory', 'T'], ['practical', 'P']].map(([value, label]) => <button key={value} onClick={() => { setTypeFilter(value); setPage(1) }} className={`min-w-11 rounded-lg px-3 py-2 text-xs font-black transition ${typeFilter === value ? value === 'theory' ? 'bg-[#246694] text-white shadow-sm' : value === 'practical' ? 'bg-[#d97706] text-white shadow-sm' : 'bg-[#191918] text-white shadow-sm' : 'text-black/35 hover:text-black'}`} aria-pressed={typeFilter === value}>{label}</button>)}</div>
                {view === 'organise' && <form onSubmit={createSubtopic} className="flex gap-2"><input value={newSubtopic} onChange={(event) => setNewSubtopic(event.target.value)} disabled={!activeTopic} placeholder={activeTopic ? `New subtopic in ${activeTopic}` : 'Select a topic'} className="min-w-0 flex-1 rounded-xl border border-[#e2e2dd] px-4 py-3 text-xs outline-none focus:border-[#625bf6] disabled:bg-black/[.02] xl:w-64"/><button disabled={!activeTopic} className="flex shrink-0 items-center gap-2 rounded-xl bg-[#191918] px-4 text-xs font-bold text-white hover:bg-[#343431] disabled:opacity-35"><Plus size={14}/>Subtopic</button></form>}
              </div>
            </div>

            <div className="mb-4 mt-8 flex items-end justify-between gap-4"><div><p className="mono text-[9px] uppercase tracking-[.18em] text-[#625bf6]">{view === 'main' ? 'Approved library' : 'Review queue'}</p><h1 className="mt-1 text-3xl font-extrabold tracking-[-.045em]">{visible.length.toLocaleString()} <span className="font-medium text-black/25">questions</span></h1></div>{view === 'organise' && <div className="hidden items-center gap-2 rounded-full border border-[#deded9] bg-white px-3 py-2 text-[11px] text-black/45 sm:flex"><span className="h-2 w-2 rounded-full bg-[#8dd72c]"/>Approving into <strong className="text-black/75">{activeTopic || 'no topic'}{activeSubtopic ? ` / ${activeSubtopic}` : ''}</strong></div>}</div>

            {loading ? <div className="py-24 text-center mono text-xs uppercase tracking-widest text-black/35">Loading the vault…</div> : displayed.length === 0 ? <div className="rounded-3xl border border-dashed border-black/15 bg-white py-24 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#eeedff] text-[#625bf6]"><FolderInput size={22}/></div><p className="mt-4 font-bold">Nothing here yet</p><p className="mt-1 text-sm text-black/40">{view === 'main' ? 'Approve questions from Organise to build your list.' : 'Try another search.'}</p></div> : <div className="overflow-hidden rounded-2xl border border-[#e2e2dd] bg-white shadow-[0_14px_45px_rgba(20,20,20,.04)]">
              <div className="question-header-grid hidden gap-4 border-b border-[#ededE8] bg-[#fafaf8] px-5 py-3 mono text-[8px] uppercase tracking-[.16em] text-black/35 sm:grid"><span>No.</span><span>Question</span><span>Classification</span><span className="text-right">Actions</span></div>
              {displayed.map((question, index) => <div key={question.id} className={`question-grid group gap-3 border-b border-[#eeeeea] px-4 py-4 last:border-0 hover:bg-[#fafaf8] sm:px-5 ${question.approved && view === 'organise' ? 'border-l-[3px] border-l-[#8dd72c] bg-[#fbfff4]' : ''}`}>
                <span className="mono text-[10px] text-black/25">{String((page - 1) * PAGE_SIZE + index + 1).padStart(4, '0')}</span>
                <div className="min-w-0">{editingId === question.id ? <input autoFocus value={editText} onChange={(event) => setEditText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') saveEdit(question.id); if (event.key === 'Escape') setEditingId(null) }} className="w-full rounded-lg border border-[#625bf6] bg-white px-3 py-2 text-sm font-semibold outline-none ring-2 ring-[#625bf6]/10"/> : <p className="text-[13px] font-semibold leading-5 text-[#292927]">{question.text}</p>}</div>
                <div className="flex flex-wrap items-center gap-1.5"><span className="max-w-28 truncate rounded-md bg-[#f0efff] px-2 py-1 mono text-[8px] uppercase tracking-wider text-[#514bd4]">{question.topic}</span>{question.subtopic && <span className="max-w-28 truncate rounded-md bg-[#f0f0ed] px-2 py-1 mono text-[8px] uppercase tracking-wider text-black/45">{question.subtopic}</span>}<span className={`rounded-md px-2 py-1 mono text-[8px] uppercase tracking-wider ${question.type === 'practical' || question.type === 'coding' ? 'bg-[#fff0db] text-[#a65d00]' : 'bg-[#e8f4ff] text-[#246694]'}`}>{question.type === 'practical' || question.type === 'coding' ? 'P · Practical' : 'T · Theory'}</span>{question.approved && view === 'organise' && <span className="rounded-md bg-[#e7f8cf] px-2 py-1 mono text-[8px] uppercase tracking-wider text-[#4d8210]">In main</span>}</div>
                {view === 'organise' && <div className="flex justify-end gap-1.5">
                  <div className="flex overflow-hidden rounded-lg border border-[#deded9] bg-white" role="group" aria-label="Question type">
                    <button onClick={() => updateQuestion(question.id, { type: 'theory' })} className={`grid h-9 w-9 place-items-center text-xs font-black transition ${question.type === 'theory' ? 'bg-[#246694] text-white' : 'text-black/35 hover:bg-[#e8f4ff] hover:text-[#246694]'}`} title="Mark as theory" aria-label="Mark as theory">T</button>
                    <button onClick={() => updateQuestion(question.id, { type: 'practical' })} className={`grid h-9 w-9 place-items-center border-l border-[#deded9] text-xs font-black transition ${question.type === 'practical' || question.type === 'coding' ? 'bg-[#d97706] text-white' : 'text-black/35 hover:bg-[#fff0db] hover:text-[#a65d00]'}`} title="Mark as practical" aria-label="Mark as practical">P</button>
                  </div>
                  {editingId === question.id ? <><button onClick={() => saveEdit(question.id)} className="grid h-9 w-9 place-items-center rounded-lg bg-[#625bf6] text-white" title="Save" aria-label="Save edit"><Save size={14}/></button><button onClick={() => setEditingId(null)} className="grid h-9 w-9 place-items-center rounded-lg border border-[#deded9] bg-white text-black/45" title="Cancel" aria-label="Cancel edit"><X size={14}/></button></> : <button onClick={() => { setEditingId(question.id); setEditText(question.text) }} className="grid h-9 w-9 place-items-center rounded-lg border border-[#deded9] bg-white text-black/40 hover:border-black/30 hover:text-black" title="Edit" aria-label="Edit question"><Edit3 size={14}/></button>}
                  <button onClick={() => removeQuestion(question.id)} className="grid h-9 w-9 place-items-center rounded-lg border border-[#deded9] bg-white text-black/35 hover:border-[#ef4444]/30 hover:bg-[#fff1f1] hover:text-[#dc2626]" title="Delete" aria-label="Delete question"><Trash2 size={14}/></button>
                  <button onClick={() => approveQuestion(question)} className={`grid h-9 w-9 place-items-center rounded-lg transition ${question.approved ? 'bg-[#dff5c2] text-[#477b0d]' : 'bg-[#191918] text-white hover:bg-[#625bf6]'}`} title="Add to main" aria-label="Add to main"><Check size={16} strokeWidth={2.7}/></button>
                </div>}
                {view === 'main' && <div className="flex justify-end gap-1.5">
                  {editingId === question.id ? <><button onClick={() => saveEdit(question.id)} className="grid h-9 w-9 place-items-center rounded-lg bg-[#625bf6] text-white" title="Save" aria-label="Save edit"><Save size={14}/></button><button onClick={() => setEditingId(null)} className="grid h-9 w-9 place-items-center rounded-lg border border-[#deded9] bg-white text-black/45" title="Cancel" aria-label="Cancel edit"><X size={14}/></button></> : <button onClick={() => { setEditingId(question.id); setEditText(question.text) }} className="grid h-9 w-9 place-items-center rounded-lg border border-[#deded9] bg-white text-black/40 hover:border-black/30 hover:text-black" title="Edit" aria-label="Edit question"><Edit3 size={14}/></button>}
                  <button onClick={() => moveToOrganise(question.id)} className="grid h-9 w-9 place-items-center rounded-lg bg-[#dc2626] text-white transition hover:bg-[#b91c1c]" title="Move to Organise" aria-label="Move to Organise"><Minus size={16} strokeWidth={2.7}/></button>
                </div>}
              </div>)}
            </div>}

            {pageCount > 1 && <div className="mt-8 flex items-center justify-center gap-4"><button disabled={page === 1} onClick={() => { setPage(page - 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="grid h-10 w-10 place-items-center rounded-xl border border-[#deded9] bg-white disabled:opacity-30"><ChevronLeft size={17}/></button><span className="mono text-[9px] uppercase tracking-wider text-black/45">Page {page} of {pageCount} · 50 per page</span><button disabled={page === pageCount} onClick={() => { setPage(page + 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="grid h-10 w-10 place-items-center rounded-xl border border-[#deded9] bg-white disabled:opacity-30"><ChevronRight size={17}/></button></div>}
            </>}
          </section>
        </main>
      </div>
    </div>
  )
}

export default App
