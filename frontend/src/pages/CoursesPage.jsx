import { useState, useEffect } from 'react';
import { coursesAPI } from '../services/api';

export default function CoursesPage() {
  const [levels, setLevels] = useState([]);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLevels();
  }, []);

  async function loadLevels() {
    try {
      const data = await coursesAPI.getLevels();
      setLevels(data);
      if (data.length > 0) {
        selectLevel(data[0].level_id);
      }
    } catch (error) {
      console.error('Failed to load levels:', error);
    } finally {
      setLoading(false);
    }
  }

  async function selectLevel(levelId) {
    setSelectedLevel(levelId);
    setLoading(true);
    try {
      const data = await coursesAPI.getUnits(levelId);
      setUnits(data);
    } catch (error) {
      console.error('Failed to load units:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading && levels.length === 0) {
    return <div className="text-center">Loading...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Course Browser</h1>

      {/* Level Selector */}
      <div className="mb-6">
        <div className="flex space-x-4">
          {levels.map((level) => (
            <button
              key={level.level_id}
              onClick={() => selectLevel(level.level_id)}
              className={`px-6 py-3 rounded-lg font-semibold ${
                selectedLevel === level.level_id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {level.title}
            </button>
          ))}
        </div>
      </div>

      {/* Units Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {units.map((unit) => (
          <div
            key={unit.unit_id}
            className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition cursor-pointer"
          >
            <h3 className="text-xl font-bold text-indigo-600 mb-2">
              Unit {unit.unit_number}
            </h3>
            <p className="text-gray-600">{unit.title}</p>
            {unit.description && (
              <p className="text-sm text-gray-500 mt-2">{unit.description}</p>
            )}
          </div>
        ))}
      </div>

      {units.length === 0 && !loading && (
        <div className="text-center text-gray-500 mt-8">
          No units found for this level. Please run the scraper first.
        </div>
      )}
    </div>
  );
}
