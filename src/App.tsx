import { Routes, Route, Navigate } from 'react-router-dom'
import { GruppenListe } from '@/routes/GruppenListe'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<GruppenListe />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
