import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { GruppenListe } from '@/routes/GruppenListe'
import { GruppeAnlegen } from '@/routes/GruppeAnlegen'
import { GruppeStart } from '@/routes/GruppeStart'
import { BelegNeu } from '@/routes/BelegNeu'
import { BelegBearbeiten } from '@/routes/BelegBearbeiten'
import { Salden } from '@/routes/Salden'
import { Einstellungen } from '@/routes/Einstellungen'
import { wendeThemeAn } from '@/lib/speicher'

export function App() {
  // The stored theme choice wins over the system setting, both directions.
  useEffect(() => {
    wendeThemeAn()
  }, [])

  return (
    <Routes>
      <Route path="/" element={<GruppenListe />} />
      <Route path="/neu" element={<GruppeAnlegen />} />
      <Route path="/g/:id" element={<GruppeStart />} />
      <Route path="/g/:id/beleg/neu" element={<BelegNeu />} />
      <Route path="/g/:id/beleg/:rid" element={<BelegBearbeiten />} />
      <Route path="/g/:id/salden" element={<Salden />} />
      <Route path="/g/:id/einstellungen" element={<Einstellungen />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
