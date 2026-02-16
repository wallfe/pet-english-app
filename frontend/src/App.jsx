import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';
import CoursesPage from './pages/CoursesPage';
import VocabularyPage from './pages/VocabularyPage';
import ExercisesPage from './pages/ExercisesPage';
import ProgressPage from './pages/ProgressPage';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        {/* Navigation */}
        <nav className="bg-indigo-600 text-white shadow-lg">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              <Link to="/" className="text-2xl font-bold">
                📚 BBC Learning English
              </Link>
              <div className="flex space-x-4">
                <Link to="/courses" className="hover:bg-indigo-700 px-3 py-2 rounded">
                  Courses
                </Link>
                <Link to="/vocabulary" className="hover:bg-indigo-700 px-3 py-2 rounded">
                  Vocabulary
                </Link>
                <Link to="/exercises" className="hover:bg-indigo-700 px-3 py-2 rounded">
                  Exercises
                </Link>
                <Link to="/progress" className="hover:bg-indigo-700 px-3 py-2 rounded">
                  Progress
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/courses" element={<CoursesPage />} />
            <Route path="/vocabulary" element={<VocabularyPage />} />
            <Route path="/exercises" element={<ExercisesPage />} />
            <Route path="/progress" element={<ProgressPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
