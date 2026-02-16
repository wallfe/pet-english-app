import { useState, useEffect } from 'react';
import { progressAPI } from '../services/api';

export default function ProgressPage() {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProgress();
  }, []);

  async function loadProgress() {
    try {
      const data = await progressAPI.getProgress();
      setProgress(data);
    } catch (error) {
      console.error('Failed to load progress:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="text-center">Loading progress...</div>;
  }

  if (!progress) {
    return <div className="text-center">Failed to load progress data</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Your Progress</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Activities Progress */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold text-indigo-600 mb-4">📖 Activities</h2>
          <div className="text-4xl font-bold text-gray-900 mb-2">
            {progress.activities.completed} / {progress.activities.total}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div
              className="bg-indigo-600 h-2 rounded-full"
              style={{ width: `${progress.activities.percentage}%` }}
            ></div>
          </div>
          <div className="text-sm text-gray-600">
            {progress.activities.percentage}% complete
          </div>
        </div>

        {/* Flashcards Progress */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold text-green-600 mb-4">🎴 Flashcards</h2>
          <div className="text-4xl font-bold text-gray-900 mb-2">
            {progress.flashcards.reviewed}
          </div>
          <div className="text-sm text-gray-600 mb-2">Cards reviewed</div>
          <div className="text-lg font-semibold text-orange-600">
            {progress.flashcards.due} due today
          </div>
        </div>

        {/* Exercises Progress */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold text-purple-600 mb-4">✏️ Exercises</h2>
          <div className="text-4xl font-bold text-gray-900 mb-2">
            {progress.exercises.attempted}
          </div>
          <div className="text-sm text-gray-600 mb-2">Exercises attempted</div>
          <div className="text-lg font-semibold text-green-600">
            {progress.exercises.accuracy}% accuracy
          </div>
          <div className="text-sm text-gray-500">
            ({progress.exercises.correct} correct)
          </div>
        </div>
      </div>

      {/* Motivational Message */}
      <div className="mt-8 bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          Keep up the great work! 🌟
        </h3>
        <p className="text-gray-700">
          {progress.activities.percentage >= 50
            ? "You're more than halfway through! Keep going!"
            : progress.flashcards.reviewed > 0
            ? "Every flashcard reviewed brings you closer to fluency!"
            : "Start your learning journey today!"}
        </p>
      </div>
    </div>
  );
}
