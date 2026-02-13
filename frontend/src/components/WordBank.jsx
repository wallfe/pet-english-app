import { useState, useEffect } from 'react'

export default function WordBank({ onClose }) {
  const [words, setWords] = useState([])

  useEffect(() => {
    const bank = JSON.parse(localStorage.getItem('pet_word_bank') || '[]')
    setWords(bank)
  }, [])

  const removeWord = (word) => {
    const updated = words.filter(w => w.word !== word)
    setWords(updated)
    localStorage.setItem('pet_word_bank', JSON.stringify(updated))
  }

  return (
    <div className="fixed right-0 top-0 h-full w-72 bg-white shadow-xl border-l border-gray-200 z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">Word Bank</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-lg"
        >
          &times;
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {words.length === 0 ? (
          <p className="text-sm text-gray-400 text-center mt-8">
            No words saved yet. Click on words while reading to add them.
          </p>
        ) : (
          <div className="space-y-2">
            {words.map(w => (
              <div
                key={w.word}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">{w.word}</p>
                  <p className="text-xs text-gray-400">{w.source}</p>
                </div>
                <button
                  onClick={() => removeWord(w.word)}
                  className="text-red-400 hover:text-red-600 text-xs"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-100 text-center">
        <p className="text-xs text-gray-400">{words.length} words saved</p>
      </div>
    </div>
  )
}
