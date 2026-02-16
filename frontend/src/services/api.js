/**
 * API Service
 * Handles all API calls to the backend
 */

const API_BASE = '/api';

async function fetchAPI(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
}

// Courses API
export const coursesAPI = {
  getLevels: () => fetchAPI('/courses/levels'),
  getUnits: (levelId) => fetchAPI(`/courses/levels/${levelId}/units`),
  getUnit: (unitId) => fetchAPI(`/courses/units/${unitId}`),
  getSessions: (unitId) => fetchAPI(`/courses/units/${unitId}/sessions`),
  getSession: (sessionId) => fetchAPI(`/courses/sessions/${sessionId}`),
  getActivities: (sessionId) => fetchAPI(`/courses/sessions/${sessionId}/activities`),
  getActivity: (activityId) => fetchAPI(`/courses/activities/${activityId}`),
  getSessionVocabulary: (sessionId) => fetchAPI(`/courses/sessions/${sessionId}/vocabulary`),
};

// Vocabulary API
export const vocabularyAPI = {
  getFlashcards: (limit = 20, difficulty = null) => {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (difficulty) params.append('difficulty', difficulty);
    return fetchAPI(`/vocabulary/flashcards?${params}`);
  },
  getDueFlashcards: (limit = 20) => fetchAPI(`/vocabulary/flashcards/due?limit=${limit}`),
  reviewFlashcard: (cardId, quality) =>
    fetchAPI(`/vocabulary/flashcards/${cardId}/review`, {
      method: 'POST',
      body: JSON.stringify({ quality }),
    }),
};

// Exercises API
export const exercisesAPI = {
  getExercises: (sessionId = null, exerciseType = null, limit = 10) => {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (sessionId) params.append('session_id', sessionId.toString());
    if (exerciseType) params.append('exercise_type', exerciseType);
    return fetchAPI(`/exercises?${params}`);
  },
  submitAnswer: (exerciseId, userAnswer) =>
    fetchAPI(`/exercises/${exerciseId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ user_answer: userAnswer }),
    }),
};

// Progress API
export const progressAPI = {
  getProgress: () => fetchAPI('/progress'),
  markActivityComplete: (activityId) =>
    fetchAPI(`/progress/activities/${activityId}/complete`, {
      method: 'POST',
    }),
};
