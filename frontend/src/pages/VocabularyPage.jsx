import { useState, useEffect } from 'react';
import { vocabularyAPI } from '../services/api';

export default function VocabularyPage() {
  const [flashcards, setFlashcards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFlashcards();
  }, []);

  async function loadFlashcards() {
    try {
      const data = await vocabularyAPI.getDueFlashcards(20);
      setFlashcards(data);
    } catch (error) {
      console.error('Failed to load flashcards:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleReview(quality) {
    const card = flashcards[currentIndex];
    try {
      await vocabularyAPI.reviewFlashcard(card.card_id, quality);
      // Move to next card
      if (currentIndex < flashcards.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setShowAnswer(false);
      } else {
        // Reload flashcards
        await loadFlashcards();
        setCurrentIndex(0);
        setShowAnswer(false);
      }
    } catch (error) {
      console.error('Failed to review flashcard:', error);
    }
  }

  if (loading) {
    return <div className="text-center">Loading flashcards...</div>;
  }

  if (flashcards.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Vocabulary Practice</h1>
        <p className="text-gray-600">
          No flashcards due for review! Great job! 🎉
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Come back later or generate more flashcards from the vocabulary.
        </p>
      </div>
    );
  }

  const card = flashcards[currentIndex];

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Vocabulary Practice</h1>

      <div className="mb-4 text-sm text-gray-600">
        Card {currentIndex + 1} of {flashcards.length}
      </div>

      {/* Flashcard */}
      <div className="bg-white rounded-lg shadow-lg p-8 mb-6 min-h-[300px] flex flex-col justify-center">
        <div className="text-4xl font-bold text-indigo-600 mb-4 text-center">
          {card.word}
        </div>

        {showAnswer ? (
          <div className="space-y-4">
            <div>
              <div className="text-sm text-gray-500">English:</div>
              <div className="text-lg">{card.definition_en}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">中文:</div>
              <div className="text-lg">{card.definition_cn}</div>
            </div>
            {card.example_en && (
              <div>
                <div className="text-sm text-gray-500">Example:</div>
                <div className="italic">"{card.example_en}"</div>
                {card.example_cn && (
                  <div className="text-gray-600 mt-1">"{card.example_cn}"</div>
                )}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowAnswer(true)}
            className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700"
          >
            Show Answer
          </button>
        )}
      </div>

      {/* Review Buttons */}
      {showAnswer && (
        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => handleReview(2)}
            className="bg-red-500 text-white px-4 py-3 rounded-lg hover:bg-red-600"
          >
            😰 Hard
          </button>
          <button
            onClick={() => handleReview(3)}
            className="bg-yellow-500 text-white px-4 py-3 rounded-lg hover:bg-yellow-600"
          >
            😐 Good
          </button>
          <button
            onClick={() => handleReview(5)}
            className="bg-green-500 text-white px-4 py-3 rounded-lg hover:bg-green-600"
          >
            😊 Easy
          </button>
        </div>
      )}
    </div>
  );
}
