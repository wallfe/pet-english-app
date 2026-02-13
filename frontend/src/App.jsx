import { Routes, Route, NavLink } from 'react-router-dom'
import Home from './pages/Home'
import Vocab from './pages/Vocab'
import Grammar from './pages/Grammar'
import Reading from './pages/Reading'
import Listening from './pages/Listening'

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/vocab', label: 'Vocabulary' },
  { to: '/grammar', label: 'Grammar' },
  { to: '/reading', label: 'Reading' },
  { to: '/listening', label: 'Listening' },
]

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center h-14 gap-1">
            <span className="font-bold text-lg text-indigo-600 mr-6">PET English</span>
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/vocab" element={<Vocab />} />
          <Route path="/grammar" element={<Grammar />} />
          <Route path="/reading" element={<Reading />} />
          <Route path="/listening" element={<Listening />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
