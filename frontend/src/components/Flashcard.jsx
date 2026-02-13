import { useState } from 'react'

const RATINGS = [
  { label: 'Forgot', value: 0, color: 'bg-red-100 text-red-700 hover:bg-red-200' },
  { label: 'Fuzzy', value: 1, color: 'bg-amber-100 text-amber-700 hover:bg-amber-200' },
  { label: 'Remembered', value: 2, color: 'bg-green-100 text-green-700 hover:bg-green-200' },
  { label: 'Easy', value: 3, color: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
]

export default function Flashcard({ word, onNext, onPrev, onRate, reviewMode }) {
  const [flipped, setFlipped] = useState(false)

  if (!word) return null

  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 0.9
    window.speechSynthesis.speak(utterance)
  }

  const handleFlip = () => setFlipped(!flipped)

  return (
    <div className="max-w-md mx-auto">
      {/* Card */}
      <div
        onClick={handleFlip}
        className="relative bg-white rounded-2xl shadow-md border border-gray-100 p-8 min-h-[200px] flex flex-col items-center justify-center cursor-pointer select-none transition-all hover:shadow-lg"
      >
        {!flipped ? (
          /* Front — English word */
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900 mb-2">{word.word}</p>
            {word.pos && <p className="text-sm text-gray-400 italic">{word.pos}</p>}
            <button
              onClick={e => { e.stopPropagation(); speak(word.word) }}
              className="mt-3 text-indigo-500 hover:text-indigo-700 text-sm"
            >
              Listen
            </button>
          </div>
        ) : (
          /* Back — Chinese + example */
          <div className="text-center">
            {word.zh && <p className="text-2xl font-semibold text-gray-800 mb-2">{word.zh}</p>}
            {word.example && (
              <p className="text-sm text-gray-500 italic mt-2">"{word.example}"</p>
            )}
            <p className="text-xs text-gray-300 mt-3">Tap to flip back</p>
          </div>
        )}

        {/* Flip indicator */}
        <div className="absolute bottom-2 right-3 text-xs text-gray-300">
          {flipped ? 'Back' : 'Front'}
        </div>
      </div>

      {/* Rating buttons (show after flip) */}
      {flipped && onRate && (
        <div className="mt-4 flex gap-2 justify-center">
          {RATINGS.map(r => (
            <button
              key={r.value}
              onClick={() => { setFlipped(false); onRate(r.value) }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${r.color}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {/* Nav buttons (non-review mode) */}
      {!reviewMode && (onPrev || onNext) && (
        <div className="mt-4 flex justify-between">
          {onPrev && (
            <button
              onClick={() => { setFlipped(false); onPrev() }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              &larr; Previous
            </button>
          )}
          <div />
          {onNext && (
            <button
              onClick={() => { setFlipped(false); onNext() }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Next &rarr;
            </button>
          )}
        </div>
      )}
    </div>
  )
}
