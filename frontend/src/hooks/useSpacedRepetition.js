import { useState, useCallback } from 'react'

const STORAGE_KEY = 'pet_word_bank'

/**
 * SM-2 spaced repetition algorithm.
 * Rating: 0=Forgot, 1=Fuzzy, 2=Remembered, 3=Easy
 */
function sm2Update(state, rating) {
  let { interval, repetition, easeFactor } = state || {
    interval: 0,
    repetition: 0,
    easeFactor: 2.5,
  }

  // Map 0-3 rating to SM-2's 0-5 scale
  const q = rating * 5 / 3

  if (q < 3) {
    // Failed — reset
    repetition = 0
    interval = 1
  } else {
    if (repetition === 0) {
      interval = 1
    } else if (repetition === 1) {
      interval = 6
    } else {
      interval = Math.round(interval * easeFactor)
    }
    repetition += 1
  }

  // Update ease factor
  easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))

  const nextReview = new Date()
  nextReview.setDate(nextReview.getDate() + interval)

  return {
    interval,
    repetition,
    easeFactor: Math.round(easeFactor * 100) / 100,
    nextReview: nextReview.toISOString(),
    lastReview: new Date().toISOString(),
  }
}

export default function useSpacedRepetition() {
  const [bank, setBank] = useState(() =>
    JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  )

  const save = useCallback((updated) => {
    setBank(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }, [])

  const rateWord = useCallback((word, rating) => {
    const updated = bank.map(w => {
      if (w.word !== word) return w
      return { ...w, sm2: sm2Update(w.sm2, rating) }
    })
    // If word not in bank, add it
    if (!updated.find(w => w.word === word)) {
      updated.push({
        word,
        source: 'flashcard',
        addedAt: new Date().toISOString(),
        sm2: sm2Update(null, rating),
      })
    }
    save(updated)
  }, [bank, save])

  const getDueWords = useCallback(() => {
    const now = new Date()
    return bank.filter(w => {
      if (!w.sm2?.nextReview) return true
      return new Date(w.sm2.nextReview) <= now
    })
  }, [bank])

  const stats = {
    learned: bank.filter(w => w.sm2?.repetition > 0).length,
    due: getDueWords().length,
    mastered: bank.filter(w => w.sm2?.repetition >= 5).length,
    total: bank.length,
  }

  return { stats, getDueWords, rateWord, bank }
}
