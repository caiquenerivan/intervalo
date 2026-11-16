import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { EarTraining } from './features/ear/EarTraining'
import { Explorer } from './features/explorer/Explorer'
import { Home } from './features/home/Home'
import { LessonList } from './features/lessons/LessonList'
import { LessonPlayer } from './features/lessons/LessonPlayer'
import { Songs } from './features/songs/Songs'
import { Tuner } from './features/tuner/Tuner'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="explore" element={<Explorer />} />
        <Route path="ear" element={<EarTraining />} />
        <Route path="tuner" element={<Tuner />} />
        <Route path="songs" element={<Songs />} />
        <Route path="lessons" element={<LessonList />} />
        <Route path="lessons/:id" element={<LessonPlayer />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
