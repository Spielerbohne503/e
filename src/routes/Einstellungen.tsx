import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Rahmen } from '@/components/Rahmen'
import { Papier } from '@/components/Papier'
import { Knopf, IkonKnopf } from '@/components/Knopf'
import { Feld, Schalter, Umschalter } from '@/components/Feld'
import { PersonChip } from '@/components/Person'
import { Skelett } from '@/components/Skelett'
import { Sheet } from '@/components/Sheet'
import { WaehrungsKnopf } from '@/components/WaehrungsWaehler'
import { BudgetFormular } from '@/features/budget/BudgetFormular'
import {
  useGruppeAendern,
  useMitgliedAendern,
  useMitgliedAnlegen,
  useMitgliedLoeschen,
  useSnapshot,
} from '@/api/hooks'
import { api } from '@/api/client'
import { nextColor } from '@/lib/colors'
import { setzeSprache, useSprache } from '@/lib/i18n'
import {
  merkeGruppe,
  merkePin,
  setzeTheme,
  themeWahl,
  tokenFuer,
  vergissGruppe,
  type ThemeWahl,
} from '@/lib/speicher'

export function Einstellungen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data, isLoading } = useSnapshot(id)

  const gruppeAendern = useGruppeAendern(id)
  const mitgliedAnlegen = useMitgliedAnlegen(id)
  const mitgliedAendern = useMitgliedAendern(id)
  const mitgliedLoeschen = useMitgliedLoeschen(id)

  const [neuerName, setNeuerName] = useState('')
  const [teilenOffen, setTeilenOffen] = useState(false)
  const [budgetOffen, setBudgetOffen] = useState(false)
  const [pinOffen, setPinOffen] = useState(false)
  const [theme, setThemeState] = useState<ThemeWahl>(() => themeWahl())
  const { sprache } = useSprache()
  const [hinweis, setHinweis] = useState<string | null>(null)

  if (isLoading || !data) {
    return (
      <Rahmen titel="Einstellungen" zurueck={`/g/${id}`}>
        <Papier className="p-6 mt-4">
          <Skelett zeilen={5} />
        </Papier>
      </Rahmen>
    )
  }

  const { group, members, budgets } = data
  const aktive = members.filter((m) => !m.archived)
  const archiviert = members.filter((m) => m.archived)
  const budget = budgets.find((b) => b.active === 1)

  const personAnlegen = () => {
    const name = neuerName.trim()
    if (!name) return
    mitgliedAnlegen.mutate({ display_name: name, color: nextColor(members.map((m) => m.color)) })
    setNeuerName('')
  }

  return (
    <Rahmen titel="Einstellungen" zurueck={`/g/${id}`}>
      <Papier className="p-5 mt-3">
        <div className="flex gap-2 items-end">
          <Feld
            label="Name der Gruppe"
            defaultValue={group.name}
            onBlur={(e) => {
              const name = e.target.value.trim()
              if (name && name !== group.name) gruppeAendern.mutate({ name })
            }}
            className="flex-1"
          />
          <div className="pb-0.5">
            <span className="block text-sm font-bold mb-1.5">Basis</span>
            <WaehrungsKnopf
              code={group.base_currency}
              onWaehlen={(code) => gruppeAendern.mutate({ base_currency: code })}
            />
          </div>
        </div>
        <p className="text-sm text-tinte-2 mt-2">
          Die Basiswährung gilt für Salden und Budget. Ein einzelner Beleg darf eine andere haben.
        </p>
      </Papier>

      {/* People */}
      <Papier className="p-5 mt-3">
        <h2 className="text-[19px] font-medium mb-3">Personen</h2>

        <ul className="grid gap-1">
          {aktive.map((m) => (
            <li key={m.id} className="flex items-center gap-2">
              <PersonChip person={m} />
              <input
                defaultValue={m.display_name}
                onBlur={(e) => {
                  const name = e.target.value.trim()
                  if (name && name !== m.display_name) {
                    mitgliedAendern.mutate({ id: m.id, display_name: name })
                  }
                }}
                aria-label={`Name von ${m.display_name}`}
                className="flex-1 min-w-0 min-h-11 px-3 rounded-klein bg-papier border border-strich focus:border-lavendel"
              />
              <IkonKnopf
                label={`${m.display_name} entfernen`}
                onClick={() =>
                  mitgliedLoeschen.mutate(m.id, {
                    onSuccess: (antwort) => {
                      if (antwort.archiviert) setHinweis(antwort.grund ?? null)
                    },
                  })
                }
              >
                <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </IkonKnopf>
            </li>
          ))}
        </ul>

        <div className="flex gap-2 mt-3">
          <input
            value={neuerName}
            onChange={(e) => setNeuerName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && personAnlegen()}
            placeholder="Noch jemand"
            aria-label="Name der neuen Person"
            className="flex-1 min-w-0 min-h-11 px-3 rounded-klein bg-papier border border-strich focus:border-lavendel"
          />
          <Knopf art="zweit" onClick={personAnlegen} disabled={!neuerName.trim()} className="shrink-0">
            Hinzufügen
          </Knopf>
        </div>

        {hinweis && (
          <p className="text-sm rounded-klein bg-bon-weich px-3 py-2 mt-3" role="status">
            {hinweis}
          </p>
        )}

        {archiviert.length > 0 && (
          <details className="mt-4">
            <summary className="text-sm text-tinte-2 cursor-pointer min-h-11 flex items-center">
              {archiviert.length} archiviert
            </summary>
            <ul className="grid gap-1 mt-2">
              {archiviert.map((m) => (
                <li key={m.id} className="flex items-center gap-2 py-1">
                  <PersonChip person={m} aktiv={false} />
                  <span className="flex-1 text-tinte-2 truncate">{m.display_name}</span>
                  <Knopf
                    art="geist"
                    onClick={() => mitgliedAendern.mutate({ id: m.id, archived: false })}
                  >
                    Zurückholen
                  </Knopf>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Papier>

      {/* Netting mode */}
      <Papier className="p-5 mt-3">
        <h2 className="text-[19px] font-medium mb-1">Wie wird ausgeglichen?</h2>
        <p className="text-sm text-tinte-2 mb-3">
          {group.netting_mode === 'graph'
            ? 'Die wenigsten Zahlungen, auch zwischen Leuten, die nie zusammen eingekauft haben.'
            : 'Nur zwischen Personen, die tatsächlich miteinander abgerechnet haben.'}
        </p>
        <Umschalter
          label="Ausgleichsart"
          wert={group.netting_mode}
          onWechsel={(w) => gruppeAendern.mutate({ netting_mode: w })}
          optionen={[
            { wert: 'graph', text: 'Dreiecke auflösen' },
            { wert: 'direct', text: 'Nur direkt' },
          ]}
        />
      </Papier>

      {/* Budget */}
      <Papier className="p-5 mt-3">
        <h2 className="text-[19px] font-medium mb-1">Budget</h2>
        {budget ? (
          <>
            <p className="text-sm text-tinte-2 mb-3">
              Es läuft ein Budget. Die Leiste steht oben auf dem Gruppenbildschirm.
            </p>
            <Knopf art="zweit" onClick={() => setBudgetOffen(true)}>
              Budget ändern
            </Knopf>
          </>
        ) : (
          <>
            <p className="text-sm text-tinte-2 mb-3">
              Ohne Budget gibt es keine Leiste. Leg eins an, wenn du eine Grenze im Blick behalten willst.
            </p>
            <Knopf art="zweit" onClick={() => setBudgetOffen(true)}>
              Budget hinzufügen
            </Knopf>
          </>
        )}
      </Papier>

      {/* Sync */}
      <Papier className="p-5 mt-3">
        <h2 className="text-[19px] font-medium mb-1">Auf mehreren Geräten</h2>
        <p className="text-sm text-tinte-2 mb-3">
          Ein Link, ein Datenraum. Wer den Link hat, sieht alles in dieser Gruppe und kann alles
          ändern.
        </p>
        <div className="flex flex-wrap gap-2">
          <Knopf onClick={() => setTeilenOffen(true)}>Sync-Link zeigen</Knopf>
          <Knopf art="zweit" onClick={() => setPinOffen(true)}>
            {group.has_pin ? 'PIN ändern' : 'PIN einrichten'}
          </Knopf>
        </div>
      </Papier>

      {/* Appearance */}
      <Papier className="p-5 mt-3">
        <h2 className="text-[19px] font-medium mb-3">Darstellung</h2>
        <Umschalter
          label="Farbschema"
          wert={theme}
          onWechsel={(w) => {
            setThemeState(w)
            setzeTheme(w)
          }}
          optionen={[
            { wert: 'system', text: 'System' },
            { wert: 'hell', text: 'Hell' },
            { wert: 'dunkel', text: 'Dunkel' },
          ]}
        />
        <div className="mt-3">
          <span className="block text-sm font-bold mb-1.5">Sprache</span>
          <Umschalter
            label="Sprache"
            wert={sprache}
            onWechsel={setzeSprache}
            optionen={[
              { wert: 'de' as const, text: 'Deutsch' },
              { wert: 'en' as const, text: 'English' },
            ]}
          />
        </div>

        <div className="mt-2">
          <Schalter
            label="Zetti anzeigen"
            beschreibung="Das Bon-Maskottchen bei leeren Listen und nach dem Abrechnen."
            an={group.show_zetti === 1}
            onWechsel={(an) => gruppeAendern.mutate({ show_zetti: an })}
          />
        </div>
      </Papier>

      {/* Removing the group */}
      <Papier className="p-5 mt-3">
        <h2 className="text-[19px] font-medium mb-1">Gruppe entfernen</h2>
        <p className="text-sm text-tinte-2 mb-3">
          Von diesem Gerät entfernen behält die Daten auf dem Server — mit dem Link kommst du zurück.
          Endgültig löschen entfernt sie überall.
        </p>
        <div className="flex flex-wrap gap-2">
          <Knopf
            art="zweit"
            onClick={() => {
              vergissGruppe(id)
              navigate('/')
            }}
          >
            Von diesem Gerät entfernen
          </Knopf>
          <Knopf
            art="gefahr"
            onClick={() => {
              if (!confirm(`„${group.name}" endgültig löschen? Das lässt sich nicht rückgängig machen.`)) return
              void api.gruppeLoeschen(id).then(() => {
                vergissGruppe(id)
                navigate('/')
              })
            }}
          >
            Endgültig löschen
          </Knopf>
        </div>
      </Papier>

      <TeilenSheet
        offen={teilenOffen}
        onSchliessen={() => setTeilenOffen(false)}
        gruppeId={id}
        gruppenName={group.name}
      />

      <PinSheet
        offen={pinOffen}
        onSchliessen={() => setPinOffen(false)}
        gruppeId={id}
        hatPin={group.has_pin}
        onSpeichern={(pin) => {
          gruppeAendern.mutate({ pin })
          merkePin(id, pin)
        }}
      />

      <Sheet offen={budgetOffen} titel="Budget" onSchliessen={() => setBudgetOffen(false)}>
        <BudgetFormular
          gruppeId={id}
          basiswaehrung={group.base_currency}
          budget={budget}
          onFertig={() => setBudgetOffen(false)}
        />
      </Sheet>
    </Rahmen>
  )
}

/**
 * The share sheet. Shows the link, warns plainly what handing it over means,
 * and offers to rotate the token, which invalidates every link shared before.
 */
function TeilenSheet({
  offen,
  onSchliessen,
  gruppeId,
  gruppenName,
}: {
  offen: boolean
  onSchliessen: () => void
  gruppeId: string
  gruppenName: string
}) {
  const [token, setToken] = useState(() => tokenFuer(gruppeId) ?? '')
  const [kopiert, setKopiert] = useState(false)
  const [laeuft, setLaeuft] = useState(false)

  const link = `${window.location.origin}/#s=${token}`

  const kopieren = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setKopiert(true)
      setTimeout(() => setKopiert(false), 2000)
    } catch {
      // Clipboard blocked; the field below is selectable, which is enough.
    }
  }

  const erneuern = async () => {
    if (!confirm('Alle bisherigen Links werden ungültig. Weiter?')) return
    setLaeuft(true)
    try {
      const antwort = await api.tokenErneuern(gruppeId)
      merkeGruppe({ id: gruppeId, token: antwort.space_token, name: gruppenName, base_currency: '' })
      setToken(antwort.space_token)
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <Sheet offen={offen} titel="Sync-Link" onSchliessen={onSchliessen}>
      <div className="rounded-karte bg-bon-weich px-4 py-3 mb-4">
        <p className="font-bold">Wer den Link hat, sieht alles</p>
        <p className="text-sm text-tinte-2 mt-0.5">
          Es gibt keine Anmeldung. Der Link ist der Zugang — gib ihn nur weiter, wenn das so gewollt ist.
        </p>
      </div>

      <input
        readOnly
        value={link}
        onFocus={(e) => e.target.select()}
        aria-label="Sync-Link"
        className="w-full min-h-11 px-3 mb-3 rounded-klein bg-papier border border-strich font-mono text-sm"
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <Knopf onClick={kopieren}>{kopiert ? 'Kopiert' : 'Link kopieren'}</Knopf>
        <Knopf art="zweit" onClick={erneuern} disabled={laeuft}>
          Token neu erzeugen
        </Knopf>
      </div>
    </Sheet>
  )
}

function PinSheet({
  offen,
  onSchliessen,
  gruppeId,
  hatPin,
  onSpeichern,
}: {
  offen: boolean
  onSchliessen: () => void
  gruppeId: string
  hatPin: boolean
  onSpeichern: (pin: string | null) => void
}) {
  const [pin, setPin] = useState('')

  return (
    <Sheet offen={offen} titel={hatPin ? 'PIN ändern' : 'PIN einrichten'} onSchliessen={onSchliessen}>
      <p className="text-sm text-tinte-2 mb-3">
        Vier Ziffern als zweites Schloss an derselben Tür. Ohne PIN kommt niemand mehr rein, auch
        nicht mit dem Link.
      </p>

      <input
        inputMode="numeric"
        maxLength={4}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
        placeholder="0000"
        aria-label="Vierstellige PIN"
        className="w-32 min-h-11 px-3 mb-4 text-center text-[22px] tracking-[0.4em] font-mono tabular rounded-klein bg-papier border border-strich focus:border-lavendel"
      />

      <div className="flex flex-wrap gap-2">
        <Knopf
          disabled={pin.length !== 4}
          onClick={() => {
            onSpeichern(pin)
            setPin('')
            onSchliessen()
          }}
        >
          PIN setzen
        </Knopf>
        {hatPin && (
          <Knopf
            art="zweit"
            onClick={() => {
              onSpeichern(null)
              merkePin(gruppeId, null)
              onSchliessen()
            }}
          >
            PIN entfernen
          </Knopf>
        )}
      </div>
    </Sheet>
  )
}
