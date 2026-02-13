import { Link } from 'react-router-dom'

const modules = [
  {
    to: '/vocab',
    title: 'Vocabulary',
    desc: 'Flashcards, spaced repetition & quizzes',
    icon: 'Aa',
    color: 'bg-blue-500',
  },
  {
    to: '/grammar',
    title: 'Grammar',
    desc: 'Exercises with AI-powered diagnostics',
    icon: 'Gr',
    color: 'bg-green-500',
  },
  {
    to: '/reading',
    title: 'Reading',
    desc: 'PET-format reading practice (Parts 1-6)',
    icon: 'Rd',
    color: 'bg-purple-500',
  },
  {
    to: '/listening',
    title: 'Listening',
    desc: 'BBC 6 Minute English & Kid Nuz',
    icon: 'Li',
    color: 'bg-orange-500',
  },
]

export default function Home() {
  // Load word bank stats from localStorage
  const wordBank = JSON.parse(localStorage.getItem('pet_word_bank') || '[]')
  const reviewDue = wordBank.filter(w => {
    if (!w.sm2) return false
    return new Date(w.sm2.nextReview) <= new Date()
  }).length

  return (
    <div>
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">PET English Trainer</h1>
        <p className="text-gray-500">AI-powered B1/B2 exam preparation</p>
      </div>

      {reviewDue > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-center">
          <p className="text-amber-800 font-medium">
            You have <span className="font-bold">{reviewDue}</span> words due for review!
          </p>
          <Link to="/vocab" className="text-amber-600 underline text-sm">Go to Vocabulary</Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {modules.map(m => (
          <Link
            key={m.to}
            to={m.to}
            className="flex items-center gap-4 p-5 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
          >
            <div className={`${m.color} text-white w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg shrink-0`}>
              {m.icon}
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">{m.title}</h2>
              <p className="text-sm text-gray-500">{m.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {wordBank.length > 0 && (
        <div className="mt-8 p-4 bg-white rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-2">Word Bank</h3>
          <p className="text-sm text-gray-500">
            {wordBank.length} words collected &middot; {reviewDue} due for review
          </p>
        </div>
      )}
    </div>
  )
}
