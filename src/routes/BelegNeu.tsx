import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Rahmen } from '@/components/Rahmen'
import { Papier } from '@/components/Papier'
import { Umschalter } from '@/components/Feld'
import { Skelett } from '@/components/Skelett'
import { KnopfLink } from '@/components/Knopf'
import { BelegEditor } from '@/features/beleg/BelegEditor'
import { FahrtRechner } from '@/features/fahrt/FahrtRechner'
import { JsonImport } from '@/features/import/JsonImport'
import { leererEntwurf, type BelegEntwurf } from '@/features/beleg/entwurf'
import { useSnapshot } from '@/api/hooks'
import { today } from '@/lib/format'

type Modus = 'einkauf' | 'fahrt' | 'import'

/** Capturing a receipt: by hand, as a trip, or from pasted JSON. */
export function BelegNeu() {
  const { id = '' } = useParams()
  const { data, isLoading } = useSnapshot(id)
  const [modus, setModus] = useState<Modus>('einkauf')
  const [entwurf, setEntwurf] = useState<BelegEntwurf | null>(null)

  if (isLoading || !data) {
    return (
      <Rahmen titel="Neuer Beleg" zurueck={`/g/${id}`}>
        <Papier className="p-6 mt-4">
          <Skelett zeilen={4} />
        </Papier>
      </Rahmen>
    )
  }

  const mitglieder = data.members.filter((m) => !m.archived)

  if (mitglieder.length === 0) {
    return (
      <Rahmen titel="Neuer Beleg" zurueck={`/g/${id}`}>
        <Papier className="p-5 mt-4">
          <p className="mb-3">Für einen Beleg braucht es mindestens eine Person.</p>
          <KnopfLink to={`/g/${id}/einstellungen`} art="zweit">
            Personen anlegen
          </KnopfLink>
        </Papier>
      </Rahmen>
    )
  }

  const start =
    entwurf ?? leererEntwurf(mitglieder[0]!.id, data.group.base_currency, today())

  return (
    <Rahmen titel="Neuer Beleg" zurueck={`/g/${id}`}>
      <div className="pt-3">
        <Umschalter
          label="Art des Belegs"
          wert={modus}
          onWechsel={(w) => {
            setModus(w)
            setEntwurf(null)
          }}
          optionen={[
            { wert: 'einkauf', text: 'Einkauf' },
            { wert: 'fahrt', text: 'Fahrt' },
            { wert: 'import', text: 'Import' },
          ]}
        />
      </div>

      {modus === 'fahrt' ? (
        <FahrtRechner gruppeId={id} snapshot={data} />
      ) : modus === 'import' && !entwurf ? (
        <JsonImport snapshot={data} onUebernehmen={setEntwurf} />
      ) : (
        // The imported draft is edited with the ordinary form — the preview
        // and the correction step are the same screen.
        <BelegEditor key={entwurf ? 'import' : 'manuell'} gruppeId={id} snapshot={data} start={start} />
      )}
    </Rahmen>
  )
}
