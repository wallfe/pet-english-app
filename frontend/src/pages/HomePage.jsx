import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">
        Welcome to BBC Learning English
      </h1>
      <p className="text-xl text-gray-600 mb-8">
        Your AI-powered platform for Cambridge PET/FCE exam preparation
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link to="/courses" className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition">
          <h2 className="text-2xl font-bold text-indigo-600 mb-2">📖 Browse Courses</h2>
          <p className="text-gray-600">
            Explore Intermediate and Lower Intermediate courses from BBC Learning English
          </p>
        </Link>

        <Link to="/vocabulary" className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition">
          <h2 className="text-2xl font-bold text-green-600 mb-2">🎴 Study Vocabulary</h2>
          <p className="text-gray-600">
            Learn with AI-generated flashcards using spaced repetition (SM-2 algorithm)
          </p>
        </Link>

        <Link to="/exercises" className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition">
          <h2 className="text-2xl font-bold text-purple-600 mb-2">✏️ Practice Exercises</h2>
          <p className="text-gray-600">
            Test your skills with PET-style reading, listening, vocabulary, and grammar exercises
          </p>
        </Link>

        <Link to="/progress" className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition">
          <h2 className="text-2xl font-bold text-orange-600 mb-2">📊 Track Progress</h2>
          <p className="text-gray-600">
            Monitor your learning progress and see your achievements
          </p>
        </Link>
      </div>

      <div className="mt-12 bg-indigo-50 p-6 rounded-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-3">Features:</h3>
        <ul className="space-y-2 text-gray-700">
          <li>✨ AI-generated Chinese explanations (child-friendly)</li>
          <li>🎯 Spaced repetition for vocabulary retention</li>
          <li>📝 Authentic BBC Learning English content</li>
          <li>🎧 Audio transcripts with highlighted keywords</li>
          <li>💪 PET exam-style practice questions</li>
        </ul>
      </div>
    </div>
  );
}
