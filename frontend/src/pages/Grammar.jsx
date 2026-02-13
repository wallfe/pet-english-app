import { useState } from 'react'
import QuizQuestion from '../components/QuizQuestion'

const GRAMMAR_TOPICS = [
  'Tenses', 'Passive Voice', 'Conditionals', 'Comparatives',
  'Relative Clauses', 'Modals', 'Articles', 'Prepositions',
  'Reported Speech', 'Gerunds & Infinitives',
]

export default function Grammar() {
  const [topic, setTopic] = useState('')
  const [exerciseType, setExerciseType] = useState('mcq')
  const [exercise, setExercise] = useState(null)
  const [loading, setLoading] = useState(false)
  const [weakPoints, setWeakPoints] = useState(() =>
    JSON.parse(localStorage.getItem('pet_grammar_weak') || '[]')
  )
  const [errorHistory, setErrorHistory] = useState(() =>
    JSON.parse(localStorage.getItem('pet_grammar_errors') || '[]')
  )

  const generateExercise = async (targetTopic = topic) => {
    setLoading(true)
    try {
      const res = await fetch('/api/grammar/exercise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exercise_type: exerciseType,
          topic: targetTopic || undefined,
          count: 5,
        }),
      })
      const data = await res.json()
      setExercise(data)
    } catch (e) {
      console.error('Failed to generate exercise:', e)
    }
    setLoading(false)
  }

  const diagnose = async () => {
    if (errorHistory.length === 0) return
    setLoading(true)
    try {
      const res = await fetch('/api/grammar/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ errors: errorHistory.slice(-20) }),
      })
      const data = await res.json()
      const points = data.weak_points || []
      setWeakPoints(points)
      localStorage.setItem('pet_grammar_weak', JSON.stringify(points))
    } catch (e) {
      console.error('Failed to diagnose:', e)
    }
    setLoading(false)
  }

  const recordError = (question, userAnswer) => {
    const entry = { question, userAnswer, timestamp: new Date().toISOString() }
    const updated = [...errorHistory, entry].slice(-50)
    setErrorHistory(updated)
    localStorage.setItem('pet_grammar_errors', JSON.stringify(updated))
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Grammar</h1>

      {/* Controls */}
      {!exercise && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <select
              value={topic}
              onChange={e => setTopic(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
            >
              <option value="">Random topic</option>
              {GRAMMAR_TOPICS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              value={exerciseType}
              onChange={e => setExerciseType(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
            >
              <option value="mcq">Multiple Choice</option>
              <option value="error_correction">Error Correction</option>
            </select>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => generateExercise()}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate Exercise'}
            </button>
            {errorHistory.length > 0 && (
              <button
                onClick={diagnose}
                disabled={loading}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Diagnose Weak Points
              </button>
            )}
          </div>

          {/* Weak points panel */}
          {weakPoints.length > 0 && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
              <h3 className="font-semibold text-red-800 mb-2">Weak Points Detected</h3>
              <div className="space-y-2">
                {weakPoints.map((wp, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <button
                      onClick={() => generateExercise(wp.area)}
                      className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 flex-shrink-0"
                    >
                      Practice: {wp.area}
                    </button>
                    <div className="text-sm text-red-700">
                      <span className="font-medium">Severity: {wp.severity}</span>
                      {wp.tip && <p className="mt-1 text-red-600">{wp.tip}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading state */}
      {loading && !exercise && (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
          <p className="mt-3 text-gray-500 text-sm">AI is generating exercises...</p>
        </div>
      )}

      {/* Exercise display */}
      {exercise && (
        <div>
          <QuizQuestion
            questions={exercise.questions || []}
            onWrong={recordError}
          />
          <div className="text-center mt-6">
            <button
              onClick={() => setExercise(null)}
              className="text-sm text-green-600 hover:text-green-800"
            >
              New exercise
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
