import { useState } from 'react'

export default function QuizQuestion({ questions, onWrong, onAnswerChange }) {
  const [userAnswers, setUserAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)

  if (!questions || questions.length === 0) {
    return <p className="text-gray-400 text-center py-8">No questions available</p>
  }

  const selectAnswer = (qIdx, answer) => {
    if (submitted) return
    const updated = { ...userAnswers, [qIdx]: answer }
    setUserAnswers(updated)
    onAnswerChange?.(qIdx, answer)
  }

  const submit = () => {
    setSubmitted(true)
    // Record wrong answers for diagnostics
    questions.forEach((q, i) => {
      if (userAnswers[i] && userAnswers[i] !== q.answer) {
        onWrong?.(q.question, userAnswers[i])
      }
    })
  }

  const score = submitted
    ? questions.reduce((acc, q, i) => acc + (userAnswers[i] === q.answer ? 1 : 0), 0)
    : null

  return (
    <div className="space-y-4">
      {questions.map((q, i) => (
        <div key={i} className="p-4 bg-white rounded-lg border border-gray-200">
          <p className="font-medium text-gray-900 mb-3">
            {i + 1}. {q.question}
          </p>

          {/* MCQ options */}
          {q.options ? (
            <div className="space-y-1.5">
              {q.options.map((opt, j) => {
                const letter = opt.charAt(0)
                const isSelected = userAnswers[i] === letter
                const isCorrect = submitted && letter === q.answer
                const isWrong = submitted && isSelected && letter !== q.answer

                return (
                  <button
                    key={j}
                    onClick={() => selectAnswer(i, letter)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      isCorrect
                        ? 'bg-green-100 text-green-800 border border-green-300'
                        : isWrong
                          ? 'bg-red-100 text-red-800 border border-red-300'
                          : isSelected
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-300'
                            : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                    }`}
                  >
                    {opt}
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
            <div className="mt-2 p-2 bg-blue-50 rounded text-sm text-blue-800">
              {q.explanation}
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
            Score: {score}/{questions.length}
          </p>
        </div>
      )}
    </div>
  )
}
