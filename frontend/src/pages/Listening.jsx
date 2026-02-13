import { useState, useEffect } from 'react'
import AudioPlayer from '../components/AudioPlayer'
import QuizQuestion from '../components/QuizQuestion'

export default function Listening() {
  const [tab, setTab] = useState('bbc')
  const [episodes, setEpisodes] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedEp, setSelectedEp] = useState(null)
  const [showTranscript, setShowTranscript] = useState(false)
  const [questions, setQuestions] = useState(null)
  const [qLoading, setQLoading] = useState(false)
  const [selectedWord, setSelectedWord] = useState(null)

  const fetchEpisodes = async (source) => {
    setLoading(true)
    setSelectedEp(null)
    setQuestions(null)
    try {
      const url = source === 'bbc' ? '/api/listening/bbc/episodes' : '/api/listening/kidnuz/episodes'
      const res = await fetch(url)
      const data = await res.json()
      setEpisodes(data.episodes || [])
    } catch (e) {
      console.error('Failed to fetch episodes:', e)
    }
    setLoading(false)
  }

  useEffect(() => { fetchEpisodes(tab) }, [tab])

  const selectEpisode = async (ep) => {
    setShowTranscript(false)
    setQuestions(null)
    setLoading(true)

    try {
      // Fetch full episode data with transcript from individual endpoint
      const url = tab === 'bbc'
        ? `/api/listening/bbc/episode/${ep.id}`
        : `/api/listening/kidnuz/episode/${ep.id}`
      const res = await fetch(url)
      const data = await res.json()
      setSelectedEp(data)
    } catch (e) {
      console.error('Failed to fetch episode:', e)
      setSelectedEp(ep) // Fallback to list data
    }
    setLoading(false)
  }

  const generateQuestions = async () => {
    const transcript = selectedEp?.transcript || selectedEp?.description
    if (!transcript) return
    setQLoading(true)
    try {
      const res = await fetch('/api/listening/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, count: 5 }),
      })
      const data = await res.json()
      setQuestions(data)
    } catch (e) {
      console.error('Failed to generate questions:', e)
    }
    setQLoading(false)
  }

  const handleWordClick = (word) => {
    const clean = word.replace(/[^a-zA-Z'-]/g, '')
    if (clean.length > 1) setSelectedWord(clean.toLowerCase())
  }

  const addToWordBank = () => {
    const bank = JSON.parse(localStorage.getItem('word_bank') || '[]')
    if (!bank.find(w => w.word === selectedWord)) {
      bank.push({
        word: selectedWord,
        source: 'listening',
        addedAt: new Date().toISOString()
      })
      localStorage.setItem('word_bank', JSON.stringify(bank))
      alert(`Added "${selectedWord}" to word bank!`)
    } else {
      alert(`"${selectedWord}" is already in word bank`)
    }
    setSelectedWord(null)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Listening</h1>

      {/* Source tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('bbc')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === 'bbc' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          BBC 6 Minute English
        </button>
        <button
          onClick={() => setTab('kidnuz')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === 'kidnuz' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Kid Nuz
        </button>
      </div>

      {/* Episode list or player */}
      {!selectedEp ? (
        <div>
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading episodes...</div>
          ) : episodes.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No episodes found</div>
          ) : (
            <div className="space-y-2">
              {episodes.map(ep => (
                <button
                  key={ep.id}
                  onClick={() => selectEpisode(ep)}
                  className="w-full text-left p-4 bg-white rounded-lg border border-gray-200 hover:border-orange-300 transition-colors"
                >
                  <h3 className="font-medium text-gray-900">{ep.title}</h3>
                  {ep.date && <p className="text-xs text-gray-400 mt-1">{ep.date}</p>}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <button
            onClick={() => setSelectedEp(null)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            &larr; Back to episodes
          </button>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-lg text-gray-900 mb-3">{selectedEp.title}</h2>

            {selectedEp.audio_url ? (
              <AudioPlayer src={selectedEp.audio_url} />
            ) : (
              <p className="text-sm text-gray-400">No audio available</p>
            )}

            {/* Transcript toggle - only for BBC */}
            {tab === 'bbc' && (selectedEp.transcript || selectedEp.description) && (
              <div className="mt-4">
                <button
                  onClick={() => setShowTranscript(!showTranscript)}
                  className="text-sm text-orange-600 hover:text-orange-800"
                >
                  {showTranscript ? 'Hide transcript' : 'Show transcript'}
                </button>
                {showTranscript && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 leading-relaxed">
                    {(selectedEp.transcript || selectedEp.description).split('\n').map((line, lineIdx) => (
                      <div key={lineIdx} className="mb-2">
                        {line.split(' ').map((word, wordIdx) => (
                          <span
                            key={wordIdx}
                            onClick={() => handleWordClick(word)}
                            className="cursor-pointer hover:bg-yellow-100 rounded px-0.5"
                          >
                            {word}{' '}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-xs text-gray-400">Tap any word to add to word bank</p>
              </div>
            )}
          </div>

          {/* Comprehension questions (BBC only) */}
          {tab === 'bbc' && (
            <div>
              {!questions ? (
                <button
                  onClick={generateQuestions}
                  disabled={qLoading}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
                >
                  {qLoading ? 'Generating questions...' : 'Generate Comprehension Questions'}
                </button>
              ) : (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-3">Comprehension Questions</h3>
                  <QuizQuestion questions={questions.questions || []} />
                  <button
                    onClick={() => setQuestions(null)}
                    className="mt-4 text-sm text-orange-600 hover:text-orange-800"
                  >
                    Generate new questions
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Word lookup popup */}
      {selectedWord && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50"
          onClick={() => setSelectedWord(null)}
        >
          <div className="bg-white rounded-xl p-5 shadow-lg max-w-sm w-full mx-4"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-bold text-lg mb-2">{selectedWord}</h3>
            <p className="text-gray-500 text-sm mb-3">Tap "Add to Word Bank" to save this word for review.</p>
            <div className="flex gap-2">
              <button
                onClick={addToWordBank}
                className="px-3 py-1.5 bg-orange-600 text-white rounded-md text-sm font-medium hover:bg-orange-700"
              >
                Add to Word Bank
              </button>
              <button
                onClick={() => setSelectedWord(null)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
