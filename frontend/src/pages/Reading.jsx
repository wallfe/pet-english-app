import { useState } from 'react'
import QuizQuestion from '../components/QuizQuestion'
import WordBank from '../components/WordBank'

const PARTS = [
  { id: 1, name: 'Part 1: Notices & Signs' },
  { id: 2, name: 'Part 2: Matching' },
  { id: 3, name: 'Part 3: True/False' },
  { id: 4, name: 'Part 4: MCQ Comprehension' },
  { id: 5, name: 'Part 5: Cloze (MCQ)' },
  { id: 6, name: 'Part 6: Open Cloze' },
]

export default function Reading() {
  const [part, setPart] = useState(1)
  const [exercise, setExercise] = useState(null)
  const [loading, setLoading] = useState(false)
  const [answers, setAnswers] = useState({})
  const [results, setResults] = useState(null)
  const [checking, setChecking] = useState(false)
  const [showWordBank, setShowWordBank] = useState(false)
  const [selectedWord, setSelectedWord] = useState(null)

  const generateExercise = async () => {
    setLoading(true)
    setExercise(null)
    setAnswers({})
    setResults(null)
    try {
      const res = await fetch(`/api/reading/exercise?part=${part}`)
      const data = await res.json()
      setExercise(data)
    } catch (e) {
      console.error('Failed to generate reading exercise:', e)
    }
    setLoading(false)
  }

  const checkAnswers = async () => {
    if (!exercise) return
    setChecking(true)
    try {
      const res = await fetch('/api/reading/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          part,
          passage: exercise.passage,
          questions: exercise.questions,
          user_answers: answers,
        }),
      })
      const data = await res.json()
      setResults(data)
    } catch (e) {
      console.error('Failed to check answers:', e)
    }
    setChecking(false)
  }

  // Handle word tap for lookup
  const handleWordClick = (word) => {
    const clean = word.replace(/[^a-zA-Z'-]/g, '')
    if (clean.length > 1) setSelectedWord(clean)
  }

  return (
    <div className="flex gap-6">
      <div className="flex-1">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Reading</h1>

        {/* Part selector */}
        {!exercise && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PARTS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPart(p.id)}
                  className={`text-left p-3 rounded-lg border text-sm transition-colors ${
                    part === p.id
                      ? 'border-purple-300 bg-purple-50 text-purple-800'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <button
              onClick={generateExercise}
              disabled={loading}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate Exercise'}
            </button>
          </div>
        )}

        {/* Exercise display */}
        {exercise && (
          <div className="space-y-6">
            {/* Passage */}
            {exercise.passage && (
              <div className="p-5 bg-white rounded-xl border border-gray-200">
                <h3 className="font-semibold text-gray-700 mb-3">Reading Passage</h3>
                <div className="text-gray-800 leading-relaxed">
                  {exercise.passage.split(' ').map((word, i) => (
                    <span
                      key={i}
                      onClick={() => handleWordClick(word)}
                      className="cursor-pointer hover:bg-yellow-100 rounded px-0.5"
                    >
                      {word}{' '}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Questions */}
            {exercise.questions && (
              <QuizQuestion
                questions={exercise.questions}
                onAnswerChange={(idx, answer) => {
                  setAnswers(prev => ({ ...prev, [idx]: answer }))
                }}
              />
            )}

            {/* Check / Results */}
            {!results ? (
              <div className="text-center">
                <button
                  onClick={checkAnswers}
                  disabled={checking}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50"
                >
                  {checking ? 'Checking...' : 'Check Answers'}
                </button>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold mb-2">
                  Score: {results.correct || 0}/{results.total || 0}
                </h3>
                {results.explanations?.map((exp, i) => (
                  <div key={i} className="mt-2 text-sm">
                    <span className={exp.correct ? 'text-green-600' : 'text-red-600'}>
                      Q{i + 1}: {exp.correct ? 'Correct' : 'Wrong'}
                    </span>
                    {exp.explanation && (
                      <p className="text-gray-600 ml-4">{exp.explanation}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="text-center">
              <button
                onClick={() => { setExercise(null); setResults(null) }}
                className="text-sm text-purple-600 hover:text-purple-800"
              >
                New exercise
              </button>
            </div>
          </div>
        )}
      </div>

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
                onClick={() => {
                  const bank = JSON.parse(localStorage.getItem('pet_word_bank') || '[]')
                  if (!bank.find(w => w.word === selectedWord)) {
                    bank.push({ word: selectedWord, source: 'reading', addedAt: new Date().toISOString() })
                    localStorage.setItem('pet_word_bank', JSON.stringify(bank))
                  }
                  setSelectedWord(null)
                }}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-md text-sm"
              >
                Add to Word Bank
              </button>
              <button
                onClick={() => setSelectedWord(null)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Word bank sidebar toggle */}
      <button
        onClick={() => setShowWordBank(!showWordBank)}
        className="fixed bottom-4 right-4 w-10 h-10 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center text-lg z-40"
        title="Word Bank"
      >
        W
      </button>
      {showWordBank && <WordBank onClose={() => setShowWordBank(false)} />}
    </div>
  )
}
