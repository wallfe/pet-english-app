import { useState, useEffect } from 'react'
import Flashcard from '../components/Flashcard'
import QuizQuestion from '../components/QuizQuestion'
import useSpacedRepetition from '../hooks/useSpacedRepetition'

const TABS = ['Flashcards', 'Review', 'Quiz']

export default function Vocab() {
  const [tab, setTab] = useState('Flashcards')
  const [level, setLevel] = useState('B1')
  const [words, setWords] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [loading, setLoading] = useState(false)
  const [quiz, setQuiz] = useState(null)
  const [quizLoading, setQuizLoading] = useState(false)

  const { stats, getDueWords, rateWord } = useSpacedRepetition()

  // Fetch words for flashcards
  const fetchWords = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/vocab/words?level=${level}&count=20`)
      const data = await res.json()
      setWords(data.words || [])
      setCurrentIdx(0)
    } catch (e) {
      console.error('Failed to fetch words:', e)
    }
    setLoading(false)
  }

  useEffect(() => { fetchWords() }, [level])

  // Generate quiz
  const generateQuiz = async (type = 'mcq') => {
    setQuizLoading(true)
    try {
      const res = await fetch('/api/vocab/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, type, count: 5 }),
      })
      const data = await res.json()
      setQuiz(data)
    } catch (e) {
      console.error('Failed to generate quiz:', e)
    }
    setQuizLoading(false)
  }

  const dueWords = getDueWords()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Vocabulary</h1>
        <select
          value={level}
          onChange={e => setLevel(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="B1">B1 (PET)</option>
          <option value="B2">B2 (FCE)</option>
        </select>
      </div>

      {/* Stats bar */}
      <div className="flex gap-4 mb-4 text-sm">
        <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full">Learned: {stats.learned}</span>
        <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full">Due: {stats.due}</span>
        <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full">Mastered: {stats.mastered}</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Flashcards tab */}
      {tab === 'Flashcards' && (
        <div>
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading words...</div>
          ) : words.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No words found</div>
          ) : (
            <div>
              <div className="text-sm text-gray-500 mb-3 text-center">
                {currentIdx + 1} / {words.length}
              </div>
              <Flashcard
                word={words[currentIdx]}
                onNext={() => setCurrentIdx(i => Math.min(i + 1, words.length - 1))}
                onPrev={() => setCurrentIdx(i => Math.max(i - 1, 0))}
                onRate={(rating) => {
                  rateWord(words[currentIdx].word, rating)
                  setCurrentIdx(i => Math.min(i + 1, words.length - 1))
                }}
              />
              <div className="flex justify-center mt-4">
                <button
                  onClick={fetchWords}
                  className="text-sm text-indigo-600 hover:text-indigo-800"
                >
                  Load new words
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Review tab */}
      {tab === 'Review' && (
        <div>
          {dueWords.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              No words due for review. Great job!
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-500 mb-4">{dueWords.length} words to review</p>
              <Flashcard
                word={dueWords[0]}
                onRate={(rating) => rateWord(dueWords[0].word, rating)}
                reviewMode
              />
            </div>
          )}
        </div>
      )}

      {/* Quiz tab */}
      {tab === 'Quiz' && (
        <div>
          {!quiz ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">Generate AI-powered vocabulary quiz</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => generateQuiz('mcq')}
                  disabled={quizLoading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {quizLoading ? 'Generating...' : 'Multiple Choice'}
                </button>
                <button
                  onClick={() => generateQuiz('fill_blank')}
                  disabled={quizLoading}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  {quizLoading ? 'Generating...' : 'Fill in the Blank'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <QuizQuestion questions={quiz.questions || []} />
              <div className="text-center mt-6">
                <button
                  onClick={() => setQuiz(null)}
                  className="text-sm text-indigo-600 hover:text-indigo-800"
                >
                  Generate new quiz
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
