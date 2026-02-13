import { useState } from 'react'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

function normalizeQuestion(q) {
  // Vocab format: { word: "afford", options: ["负担得起","拒绝",...], answer: "负担得起" }
  // Grammar format: { sentence: "If I ___ ...", options: ["had","have",...], answer: "had" }
  // Reading/Listening: { question: "What...", options: ["A) x","B) y",...], answer: "B" }

  const isVocab = !!q.word
  const question = q.question || q.sentence || q.word || ''
  const rawOptions = q.options || []

  // Detect if options already have letter prefixes like "A) ..."
  const hasPrefix = rawOptions.length > 0 && /^[A-F]\)\s/.test(rawOptions[0])

  const options = rawOptions.map((opt, j) => {
    if (hasPrefix) {
      return { display: opt, letter: opt.charAt(0) }
    }
    return { display: `${LETTERS[j]}) ${opt}`, letter: LETTERS[j] }
  })

  // Normalize answer to a letter
  // Support both 'correct_answer' (new format) and 'answer' (old format)
  let answer = q.correct_answer || q.answer || ''
  if (!hasPrefix && answer.length > 1) {
    // Answer is full text like "had" or "负担得起" — find matching option index
    const idx = rawOptions.findIndex(o => o === answer)
    if (idx >= 0) answer = LETTERS[idx]
  }

  return {
    question,
    options,
    answer,
    explanation: q.explanation || '',
    tip: q.tip || '',
    isVocab,
    word: q.word
  }
}

export default function QuizQuestion({ questions, onWrong, onAnswerChange }) {
  const [userAnswers, setUserAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)

  if (!questions || questions.length === 0) {
    return <p className="text-gray-400 text-center py-8">No questions available</p>
  }

  const normalized = questions.map(normalizeQuestion)

  const selectAnswer = (qIdx, letter) => {
    if (submitted) return
    const updated = { ...userAnswers, [qIdx]: letter }
    setUserAnswers(updated)
    onAnswerChange?.(qIdx, letter)
  }

  const submit = () => {
    setSubmitted(true)
    normalized.forEach((q, i) => {
      if (userAnswers[i] && userAnswers[i] !== q.answer) {
        onWrong?.(q.question, userAnswers[i])
      }
    })
  }

  const score = submitted
    ? normalized.reduce((acc, q, i) => acc + (userAnswers[i] === q.answer ? 1 : 0), 0)
    : null

  return (
    <div className="space-y-4">
      {normalized.map((q, i) => (
        <div key={i} className={`p-5 rounded-xl border transition-shadow ${
          q.isVocab
            ? 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 hover:shadow-md'
            : 'bg-white border-gray-200'
        }`}>
          {q.isVocab ? (
            // Vocab quiz: show word prominently
            <div className="text-center mb-4">
              <div className="inline-block px-6 py-3 bg-white rounded-xl shadow-sm border border-orange-200">
                <span className="text-3xl font-bold text-gray-900">{q.word}</span>
              </div>
            </div>
          ) : (
            // Other quiz types: show question text
            <p className="font-medium text-gray-900 mb-3">
              {i + 1}. {q.question}
            </p>
          )}

          {/* MCQ options */}
          {q.options.length > 0 ? (
            <div className={q.isVocab ? 'grid grid-cols-2 gap-3' : 'space-y-1.5'}>
              {q.options.map((opt, j) => {
                const isSelected = userAnswers[i] === opt.letter
                const isCorrect = submitted && opt.letter === q.answer
                const isWrong = submitted && isSelected && opt.letter !== q.answer

                return (
                  <button
                    key={j}
                    onClick={() => selectAnswer(i, opt.letter)}
                    disabled={submitted}
                    className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-all ${
                      q.isVocab ? 'text-base' : 'text-sm'
                    } ${
                      isCorrect
                        ? 'bg-green-100 text-green-800 border-2 border-green-400 shadow-sm'
                        : isWrong
                          ? 'bg-red-100 text-red-800 border-2 border-red-400 shadow-sm'
                          : isSelected
                            ? q.isVocab
                              ? 'bg-orange-100 text-orange-800 border-2 border-orange-400 shadow-md transform scale-105'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-300'
                            : q.isVocab
                              ? 'bg-white hover:bg-orange-50 border-2 border-gray-300 hover:border-orange-300 shadow-sm hover:shadow'
                              : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                    }`}
                  >
                    {opt.display}
                  </button>
                )
              })}
            </div>
          ) : (
            /* Fill in the blank */
            <input
              type="text"
              placeholder="Type your answer..."
              value={userAnswers[i] || ''}
              onChange={e => selectAnswer(i, e.target.value)}
              disabled={submitted}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          )}

          {/* Explanation (after submit) */}
          {submitted && q.explanation && (
            <div className="mt-3 space-y-2">
              {typeof q.explanation === 'string' ? (
                // Old format: single string
                <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800 leading-relaxed">
                  {q.explanation}
                </div>
              ) : (
                // New format: per-option object
                <div className="space-y-1.5">
                  {q.explanation.correct && (
                    <div className="p-2.5 bg-green-50 rounded-lg text-sm text-green-900 leading-relaxed border-l-4 border-green-500">
                      {q.explanation.correct}
                    </div>
                  )}
                  {[q.explanation.wrong_1, q.explanation.wrong_2, q.explanation.wrong_3].filter(Boolean).map((exp, idx) => (
                    <div key={idx} className="p-2.5 bg-red-50 rounded-lg text-sm text-red-900 leading-relaxed border-l-4 border-red-400">
                      {exp}
                    </div>
                  ))}
                  {q.tip && (
                    <div className="p-2.5 bg-amber-50 rounded-lg text-sm text-amber-900 leading-relaxed border-l-4 border-amber-500">
                      💡 {q.tip}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Submit / Score */}
      {!submitted ? (
        <div className="text-center">
          <button
            onClick={submit}
            disabled={Object.keys(userAnswers).length === 0}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            Submit Answers
          </button>
        </div>
      ) : (
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <p className="font-semibold text-lg">
            Score: {score}/{normalized.length}
          </p>
        </div>
      )}
    </div>
  )
}
