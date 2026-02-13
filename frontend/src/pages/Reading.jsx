import { useState, useEffect } from 'react'
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
  const [mode, setMode] = useState('practice') // 'practice' | 'exam' | 'summary' | 'history'
  const [part, setPart] = useState(1)
  const [exercise, setExercise] = useState(null)
  const [loading, setLoading] = useState(false)
  const [answers, setAnswers] = useState({})
  const [results, setResults] = useState(null)
  const [checking, setChecking] = useState(false)
  const [showWordBank, setShowWordBank] = useState(false)
  const [selectedWord, setSelectedWord] = useState(null)

  // Exam mode state
  const [examData, setExamData] = useState(null)
  const [currentPart, setCurrentPart] = useState(1)
  const [examStartTime, setExamStartTime] = useState(null)
  const [examDuration, setExamDuration] = useState(0)
  const [examHistory, setExamHistory] = useState(() =>
    JSON.parse(localStorage.getItem('pet_reading_exams') || '[]')
  )

  // Timer for exam mode
  useEffect(() => {
    if (mode === 'exam' && examStartTime) {
      const timer = setInterval(() => {
        setExamDuration(Math.floor((Date.now() - examStartTime) / 1000))
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [mode, examStartTime])

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
      const correctAnswers = {}
      exercise.questions.forEach((q, i) => {
        correctAnswers[String(i)] = q.correct_answer || q.answer || ''
      })
      const res = await fetch('/api/reading/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          part,
          answers,
          correct_answers: correctAnswers,
          questions: exercise.questions,
        }),
      })
      const data = await res.json()
      setResults(data)
    } catch (e) {
      console.error('Failed to check answers:', e)
    }
    setChecking(false)
  }

  // Start full exam (Part 1-6)
  const startExam = async () => {
    setMode('exam')
    setCurrentPart(1)
    setExamStartTime(Date.now())
    setExamDuration(0)
    setExamData({
      parts: [],
      answers: {},
      startTime: new Date().toISOString(),
    })
    // Generate first part
    await generateExamPart(1)
  }

  const generateExamPart = async (partNum) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reading/exercise?part=${partNum}`)
      const data = await res.json()
      setExercise(data)
      setAnswers({})
    } catch (e) {
      console.error('Failed to generate exam part:', e)
    }
    setLoading(false)
  }

  const nextExamPart = async () => {
    // Save current part answers
    const partData = {
      part: currentPart,
      passage: exercise?.passage || '',
      questions: exercise?.questions || [],
      userAnswers: { ...answers },
    }

    setExamData(prev => ({
      ...prev,
      parts: [...prev.parts, partData],
      answers: { ...prev.answers, [currentPart]: answers }
    }))

    if (currentPart < 6) {
      setCurrentPart(currentPart + 1)
      await generateExamPart(currentPart + 1)
    } else {
      // Exam finished, show summary
      await finishExam(partData)
    }
  }

  const finishExam = async (lastPartData) => {
    const allParts = [...examData.parts, lastPartData]
    const endTime = new Date().toISOString()
    const duration = examDuration

    // Check all answers
    setLoading(true)
    const checkedParts = []
    let totalScore = 0
    let totalQuestions = 0

    for (const partData of allParts) {
      try {
        const correctAnswers = {}
        partData.questions.forEach((q, i) => {
          correctAnswers[String(i)] = q.correct_answer || q.answer || ''
        })

        const res = await fetch('/api/reading/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            part: partData.part,
            answers: partData.userAnswers,
            correct_answers: correctAnswers,
            questions: partData.questions,
          }),
        })
        const checkResult = await res.json()

        checkedParts.push({
          ...partData,
          results: checkResult,
          score: checkResult.score || 0,
          total: checkResult.total || 0,
        })

        totalScore += checkResult.score || 0
        totalQuestions += checkResult.total || 0
      } catch (e) {
        console.error('Failed to check part:', e)
      }
    }

    const examRecord = {
      id: Date.now(),
      startTime: examData.startTime,
      endTime,
      duration,
      parts: checkedParts,
      totalScore,
      totalQuestions,
    }

    // Save to history
    const newHistory = [examRecord, ...examHistory].slice(0, 20) // Keep last 20 exams
    setExamHistory(newHistory)
    localStorage.setItem('pet_reading_exams', JSON.stringify(newHistory))

    setExamData(examRecord)
    setMode('summary')
    setLoading(false)
  }

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Handle word tap for lookup
  const handleWordClick = (word) => {
    const clean = word.replace(/[^a-zA-Z'-]/g, '')
    if (clean.length > 1) setSelectedWord(clean)
  }

  // === RENDER ===

  if (mode === 'history') {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Exam History</h1>
          <button
            onClick={() => setMode('practice')}
            className="text-sm text-purple-600 hover:text-purple-800"
          >
            ← Back
          </button>
        </div>

        {examHistory.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No exam records yet. Take a mock exam to get started!
          </div>
        ) : (
          <div className="space-y-3">
            {examHistory.map(exam => (
              <div key={exam.id} className="p-4 bg-white rounded-lg border border-gray-200 hover:border-purple-300 cursor-pointer"
                onClick={() => {
                  setExamData(exam)
                  setMode('summary')
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">
                      Score: {exam.totalScore}/{exam.totalQuestions} ({Math.round(exam.totalScore / exam.totalQuestions * 100)}%)
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(exam.startTime).toLocaleString()} • Duration: {formatDuration(exam.duration)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-purple-600">
                      {Math.round(exam.totalScore / exam.totalQuestions * 100)}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (mode === 'summary' && examData) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Exam Summary</h1>
          <button
            onClick={() => {
              setMode('practice')
              setExamData(null)
            }}
            className="text-sm text-purple-600 hover:text-purple-800"
          >
            ← Back to Practice
          </button>
        </div>

        {/* Overall score */}
        <div className="p-6 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-200 mb-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-3xl font-bold text-purple-600">
                {examData.totalScore}/{examData.totalQuestions}
              </div>
              <div className="text-sm text-gray-600 mt-1">Total Score</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-indigo-600">
                {Math.round(examData.totalScore / examData.totalQuestions * 100)}%
              </div>
              <div className="text-sm text-gray-600 mt-1">Accuracy</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-600">
                {formatDuration(examData.duration)}
              </div>
              <div className="text-sm text-gray-600 mt-1">Time Spent</div>
            </div>
          </div>
        </div>

        {/* Per-part breakdown */}
        <div className="space-y-4">
          {examData.parts.map((partData, idx) => (
            <div key={idx} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Part header */}
              <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">
                  {PARTS.find(p => p.id === partData.part)?.name}
                </h3>
                <div className="text-sm font-medium">
                  <span className={partData.score === partData.total ? 'text-green-600' : 'text-gray-600'}>
                    {partData.score}/{partData.total}
                  </span>
                </div>
              </div>

              {/* Passage */}
              {partData.passage && (
                <div className="p-4 bg-gray-50 border-b border-gray-200">
                  <p className="text-sm text-gray-700 leading-relaxed">{partData.passage}</p>
                </div>
              )}

              {/* Questions */}
              <div className="p-4 space-y-3">
                {partData.questions.map((q, qIdx) => {
                  const userAnswer = partData.userAnswers[qIdx] || ''
                  const correctAnswer = q.correct_answer || q.answer || ''
                  const isCorrect = userAnswer === correctAnswer
                  const resultDetail = partData.results?.results?.[qIdx]

                  return (
                    <div key={qIdx} className="pb-3 border-b border-gray-100 last:border-0">
                      <p className="text-sm font-medium text-gray-900 mb-2">
                        {qIdx + 1}. {q.question || q.sentence}
                      </p>
                      <div className="text-sm space-y-1">
                        <p>
                          <span className="text-gray-500">Your answer: </span>
                          <span className={isCorrect ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                            {userAnswer || '(not answered)'}
                          </span>
                        </p>
                        {!isCorrect && (
                          <p>
                            <span className="text-gray-500">Correct answer: </span>
                            <span className="text-green-600 font-medium">{correctAnswer}</span>
                          </p>
                        )}
                        {resultDetail?.explanation && (
                          <p className="text-gray-600 italic mt-1">{resultDetail.explanation}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (mode === 'exam') {
    return (
      <div>
        {/* Exam header with timer */}
        <div className="flex items-center justify-between mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Mock Exam - Part {currentPart}/6
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {PARTS.find(p => p.id === currentPart)?.name}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-mono font-bold text-purple-600">
              {formatDuration(examDuration)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Time elapsed</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5, 6].map(p => (
              <div key={p} className={`flex-1 h-2 rounded ${
                p < currentPart ? 'bg-green-500' :
                p === currentPart ? 'bg-purple-500' :
                'bg-gray-200'
              }`} />
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
            <p className="mt-3 text-gray-500 text-sm">Loading Part {currentPart}...</p>
          </div>
        ) : exercise ? (
          <div className="space-y-6">
            {/* Passage */}
            {exercise.passage && (
              <div className="p-5 bg-white rounded-xl border border-gray-200">
                <h3 className="font-semibold text-gray-700 mb-3">Reading Passage</h3>
                <div className="text-gray-800 leading-relaxed">
                  {exercise.passage.split(' ').map((word, i) => (
                    <span key={i} className="inline">
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

            {/* Navigation */}
            <div className="text-center">
              <button
                onClick={nextExamPart}
                disabled={Object.keys(answers).length === 0}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50"
              >
                {currentPart < 6 ? `Continue to Part ${currentPart + 1}` : 'Finish Exam'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  // Practice mode (default)
  return (
    <div className="flex gap-6">
      <div className="flex-1">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Reading</h1>

        {/* Mode selector */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={startExam}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
          >
            📝 Start Mock Exam (Part 1-6)
          </button>
          <button
            onClick={() => setMode('history')}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            📊 View Exam History
          </button>
        </div>

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

        {/* Loading state */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
            <p className="mt-3 text-gray-500 text-sm">AI is generating your exercise...</p>
          </div>
        )}

        {/* Exercise display */}
        {exercise && !loading && (
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
                  Score: {results.score ?? 0}/{results.total || 0}
                </h3>
                {results.results?.map((r, i) => (
                  <div key={i} className="mt-2 text-sm">
                    <span className={r.correct ? 'text-green-600' : 'text-red-600'}>
                      Q{i + 1}: {r.correct ? 'Correct' : 'Wrong'}
                    </span>
                    {r.explanation && (
                      <p className="text-gray-600 ml-4">{r.explanation}</p>
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
                  const bank = JSON.parse(localStorage.getItem('word_bank') || '[]')
                  if (!bank.find(w => w.word === selectedWord)) {
                    bank.push({ word: selectedWord, source: 'reading', addedAt: new Date().toISOString() })
                    localStorage.setItem('word_bank', JSON.stringify(bank))
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
