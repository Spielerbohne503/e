import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Rahmen, SchwebeAktion } from '@/components/Rahmen'
import { Karteikarte, Papier } from '@/components/Papier'
import { Knopf, KnopfLink } from '@/components/Knopf'
import { LeerZustand } from '@/components/Zetti'
import { Skelett } from '@/components/Skelett'
import { gruppenListe, merkeGruppe, tokenAusHash, type GespeicherteGruppe } from '@/lib/speicher'
import { ApiFehler, laeuftLokal, pruefeBackend } from '@/api/client'
import { LokalHinweis } from '@/components/LokalHinweis'
import { formatDate } from '@/lib/format'

/**
 * The starting screen: every group this device knows about.
 *
 * A group is remembered locally by its token. Opening a sync link adds a
 * group to this list; clearing site data removes it, which is why the share
 * dialog says to keep the link.
 */
export function GruppenListe() {
  const navigate = useNavigate()
  const [gruppen, setGruppen] = useState<GespeicherteGruppe[]>(() => gruppenListe())
  const [linkLaeuft, setLinkLaeuft] = useState(false)
  const [linkFehler, setLinkFehler] = useState<string | null>(null)
  const [lokalerModus, setLokalerModus] = useState(false)

  // Find out once whether the Worker has a database. Without one the app
  // works against local storage instead, so this only decides whether to
  // show the notice — nothing is blocked either way.
  useEffect(() => {
    void pruefeBackend().then(() => setLokalerModus(laeuftLokal()))
  }, [])

  // A sync link arrives as #s=<token>. Resolve it, remember the group, open it.
  useEffect(() => {
    const token = tokenAusHash()
    if (!token) return

    setLinkLaeuft(true)
    ;(async () => {
      try {
        const antwort = await fetch('/api/space', { headers: { 'X-Quitt-Token': token } })
        if (!antwort.ok) {
          setLinkFehler(
            antwort.status === 401
              ? 'Diese Gruppe ist mit einer PIN geschützt'
              : 'Der Link gilt nicht mehr',
          )
          return
        }
        const snapshot = (await antwort.json()) as { group: { id: string; name: string; base_currency: string } }
        merkeGruppe({
          id: snapshot.group.id,
          token,
          name: snapshot.group.name,
          base_currency: snapshot.group.base_currency,
        })
        navigate(`/g/${snapshot.group.id}`)
      } catch {
        setLinkFehler('Keine Verbindung')
      } finally {
        setLinkLaeuft(false)
        setGruppen(gruppenListe())
      }
    })()
  }, [navigate])

  if (linkLaeuft) {
    return (
      <Rahmen>
        <Papier className="p-6 mt-4">
          <Skelett zeilen={3} />
        </Papier>
      </Rahmen>
    )
  }

  return (
    <Rahmen>
      {lokalerModus && <LokalHinweis />}

      {linkFehler && (
        <div className="mt-4 rounded-karte bg-fehler-weich text-fehler px-4 py-3" role="alert">
          {linkFehler}
        </div>
      )}

      {gruppen.length === 0 ? (
        <LeerZustand text="Noch keine Gruppe. Leg eine an, dann kann es losgehen.">
          <KnopfLink to="/neu">Gruppe anlegen</KnopfLink>
        </LeerZustand>
      ) : (
        <>
          <ul className="grid gap-3 pt-3">
            {gruppen.map((g, i) => (
              <li key={g.id}>
                <Link to={`/g/${g.id}`} className="block">
                  {/* At most three tilted elements per screen, so only the
                      first two cards lean. */}
                  <Karteikarte kipp={i === 0 ? 'r' : i === 1 ? 'l' : undefined}>
                    <span className="font-fredoka text-[18px] font-medium">{g.name}</span>
                    <div className="font-mono tabular text-sm text-tinte-2 mt-1">
                      {g.base_currency} · zuletzt {formatDate(new Date(g.zuletztGeoeffnet).toISOString().slice(0, 10))}
                    </div>
                  </Karteikarte>
                </Link>
              </li>
            ))}
          </ul>

          <SchwebeAktion>
            <KnopfLink to="/neu">Neue Gruppe</KnopfLink>
          </SchwebeAktion>
        </>
      )}
    </Rahmen>
  )
}

/** Joining an existing group by pasting a link, for the case where tapping it did not work. */
export function LinkEinloesen() {
  const navigate = useNavigate()
  const [link, setLink] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)

  const einloesen = async () => {
    const treffer = /([a-z0-9]{32})/.exec(link)
    if (!treffer) {
      setFehler('In dem Link steckt kein gültiger Token')
      return
    }

    setLaeuft(true)
    setFehler(null)
    try {
      const antwort = await fetch('/api/space', { headers: { 'X-Quitt-Token': treffer[1]! } })
      if (!antwort.ok) {
        setFehler(antwort.status === 401 ? 'Diese Gruppe ist mit einer PIN geschützt' : 'Der Link gilt nicht mehr')
        return
      }
      const snapshot = (await antwort.json()) as {
        group: { id: string; name: string; base_currency: string }
      }
      merkeGruppe({
        id: snapshot.group.id,
        token: treffer[1]!,
        name: snapshot.group.name,
        base_currency: snapshot.group.base_currency,
      })
      navigate(`/g/${snapshot.group.id}`)
    } catch (e) {
      setFehler(e instanceof ApiFehler ? e.message : 'Keine Verbindung')
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <Papier className="p-5 mt-4">
      <h2 className="text-[19px] font-medium mb-1">Einer Gruppe beitreten</h2>
      <p className="text-sm text-tinte-2 mb-3">Sync-Link einfügen, den dir jemand geschickt hat.</p>
      <input
        value={link}
        onChange={(e) => setLink(e.target.value)}
        placeholder="https://…/#s=…"
        aria-label="Sync-Link"
        className="w-full min-h-11 px-3.5 rounded-klein bg-papier border border-strich focus:border-lavendel mb-3"
      />
      {fehler && (
        <p className="text-sm text-fehler mb-3" role="alert">
          {fehler}
        </p>
      )}
      <Knopf onClick={einloesen} disabled={laeuft || !link.trim()}>
        Beitreten
      </Knopf>
    </Papier>
  )
}
