import { useState, useEffect } from 'react';
import { exercisesAPI } from '../services/api';

export default function ExercisesPage() {
  const [exercises, setExercises] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExercises();
  }, []);

  async function loadExercises() {
    try {
      const data = await exercisesAPI.getExercises(null, null, 10);
      setExercises(data);
    } catch (error) {
      console.error('Failed to load exercises:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!selectedAnswer) return;

    const exercise = exercises[currentIndex];
    try {
      const data = await exercisesAPI.submitAnswer(exercise.exercise_id, selectedAnswer);
      setResult(data);
    } catch (error) {
      console.error('Failed to submit answer:', error);
    }
  }

  function nextExercise() {
    if (currentIndex < exercises.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer('');
      setResult(null);
    } else {
      loadExercises();
      setCurrentIndex(0);
      setSelectedAnswer('');
      setResult(null);
    }
  }

  if (loading) {
    return <div className="text-center">Loading exercises...</div>;
  }

  if (exercises.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Practice Exercises</h1>
        <p className="text-gray-600">
          No exercises available yet. Please generate exercises first using the Gemini generator.
        </p>
      </div>
    );
  }

  const exercise = exercises[currentIndex];
  const options = JSON.parse(exercise.options || '[]');

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Practice Exercises</h1>

      <div className="mb-4 flex justify-between text-sm text-gray-600">
        <span>Exercise {currentIndex + 1} of {exercises.length}</span>
        <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
          {exercise.exercise_type?.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Question */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="text-lg mb-4">{exercise.question}</div>

        {/* Options */}
        <div className="space-y-3">
          {options.map((option, index) => (
            <label
              key={index}
              className={`block p-4 rounded-lg border-2 cursor-pointer transition ${
                selectedAnswer === option
                  ? 'border-indigo-600 bg-indigo-50'
                  : 'border-gray-200 hover:border-indigo-300'
              } ${
                result && option === result.correct_answer
                  ? 'border-green-500 bg-green-50'
                  : result && selectedAnswer === option && !result.is_correct
                  ? 'border-red-500 bg-red-50'
                  : ''
              }`}
            >
              <input
                type="radio"
                name="answer"
                value={option}
                checked={selectedAnswer === option}
                onChange={(e) => setSelectedAnswer(e.target.value)}
                disabled={!!result}
                className="mr-3"
              />
              {option}
            </label>
          ))}
        </div>

        {/* Result */}
        {result && (
          <div className={`mt-6 p-4 rounded-lg ${
            result.is_correct ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <div className="font-bold mb-2">
              {result.is_correct ? '✅ Correct!' : '❌ Incorrect'}
            </div>
            {!result.is_correct && (
              <div className="text-sm mb-2">
                Correct answer: <strong>{result.correct_answer}</strong>
              </div>
            )}
            {result.explanation && (
              <div className="text-sm text-gray-700">
                <strong>Explanation:</strong> {result.explanation}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        {!result ? (
          <button
            onClick={handleSubmit}
            disabled={!selectedAnswer}
            className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Submit Answer
          </button>
        ) : (
          <button
            onClick={nextExercise}
            className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700"
          >
            Next Exercise
          </button>
        )}
      </div>
    </div>
  );
}
