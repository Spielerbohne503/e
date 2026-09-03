import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Rahmen } from '@/components/Rahmen'
import { Papier } from '@/components/Papier'
import { Knopf, IkonKnopf } from '@/components/Knopf'
import { Feld } from '@/components/Feld'
import { PersonChip } from '@/components/Person'
import { WaehrungsKnopf } from '@/components/WaehrungsWaehler'
import { api, ApiFehler } from '@/api/client'
import { merkeGruppe } from '@/lib/speicher'
import { MEMBER_COLORS, nextColor } from '@/lib/colors'

interface EntwurfPerson {
  name: string
  color: string
}

export function GruppeAnlegen() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [waehrung, setWaehrung] = useState('EUR')
  const [personen, setPersonen] = useState<EntwurfPerson[]>([
    { name: '', color: MEMBER_COLORS[0] },
    { name: '', color: MEMBER_COLORS[1] },
  ])
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)

  const gueltigePersonen = personen.filter((p) => p.name.trim())
  const kannSpeichern = name.trim().length > 0 && gueltigePersonen.length >= 1

  const personHinzu = () => {
    setPersonen((alt) => [...alt, { name: '', color: nextColor(alt.map((p) => p.color)) }])
  }

  const anlegen = async () => {
    setLaeuft(true)
    setFehler(null)
    try {
      const antwort = await api.gruppeAnlegen({
        name: name.trim(),
        base_currency: waehrung,
        members: gueltigePersonen.map((p) => ({ display_name: p.name.trim(), color: p.color })),
      })

      merkeGruppe({
        id: antwort.group.id,
        token: antwort.space_token,
        name: antwort.group.name,
        base_currency: antwort.group.base_currency,
      })
      navigate(`/g/${antwort.group.id}`, { replace: true })
    } catch (e) {
      setFehler(e instanceof ApiFehler ? e.message : 'Da ist etwas schiefgegangen')
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <Rahmen titel="Neue Gruppe" zurueck="/">
      <Papier className="p-5 mt-3">
        <div className="flex gap-2 items-end">
          <Feld
            label="Wie heißt die Gruppe?"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="WG, Urlaub Kroatien, …"
            autoFocus
            maxLength={80}
            className="flex-1"
          />
          <div className="pb-0.5">
            <span className="block text-sm font-bold mb-1.5">Währung</span>
            <WaehrungsKnopf code={waehrung} onWaehlen={setWaehrung} />
          </div>
        </div>
      </Papier>

      <Papier className="p-5 mt-3">
        <h2 className="text-[19px] font-medium mb-1">Wer ist dabei?</h2>
        <p className="text-sm text-tinte-2 mb-3">
          Namen reichen. Niemand braucht ein Konto, niemand bekommt eine E-Mail.
        </p>

        <ul className="grid gap-2">
          {personen.map((p, i) => (
            <li key={i} className="flex items-center gap-2">
              <PersonChip person={{ id: `entwurf${i}`, display_name: p.name || '?', color: p.color }} />
              <input
                value={p.name}
                onChange={(e) =>
                  setPersonen((alt) => alt.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                }
                placeholder={`Person ${i + 1}`}
                aria-label={`Name der ${i + 1}. Person`}
                maxLength={60}
                className="flex-1 min-h-11 px-3.5 rounded-klein bg-papier border border-strich focus:border-lavendel"
              />
              {personen.length > 1 && (
                <IkonKnopf
                  label={`${p.name || `Person ${i + 1}`} entfernen`}
                  onClick={() => setPersonen((alt) => alt.filter((_, j) => j !== i))}
                >
                  <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </IkonKnopf>
              )}
            </li>
          ))}
        </ul>

        <Knopf art="geist" onClick={personHinzu} className="mt-3 -ml-1">
          + Noch jemand
        </Knopf>
      </Papier>

      {fehler && (
        <p className="mt-3 rounded-karte bg-fehler-weich text-fehler px-4 py-3" role="alert">
          {fehler}
        </p>
      )}

      <Knopf breit onClick={anlegen} disabled={!kannSpeichern || laeuft} className="mt-4">
        {laeuft ? 'Wird angelegt' : 'Gruppe anlegen'}
      </Knopf>
    </Rahmen>
  )
}
