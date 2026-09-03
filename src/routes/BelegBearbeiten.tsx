import { useParams } from 'react-router-dom'
import { Rahmen } from '@/components/Rahmen'
import { Papier } from '@/components/Papier'
import { Skelett } from '@/components/Skelett'
import { BelegEditor } from '@/features/beleg/BelegEditor'
import { FahrtRechner } from '@/features/fahrt/FahrtRechner'
import { alsEntwurf } from '@/features/beleg/entwurf'
import type { TravelSnapshot } from '@/core/travel'
import { useSnapshot } from '@/api/hooks'

export function BelegBearbeiten() {
  const { id = '', rid = '' } = useParams()
  const { data, isLoading } = useSnapshot(id)

  if (isLoading || !data) {
    return (
      <Rahmen titel="Beleg" zurueck={`/g/${id}`}>
        <Papier className="p-6 mt-4">
          <Skelett zeilen={5} />
        </Papier>
      </Rahmen>
    )
  }

  const beleg = data.receipts.find((r) => r.id === rid)
  if (!beleg) {
    return (
      <Rahmen titel="Beleg" zurueck={`/g/${id}`}>
        <Papier className="p-6 mt-4">
          <p>Diesen Beleg gibt es nicht mehr.</p>
        </Papier>
      </Rahmen>
    )
  }

  // A trip reopens in the trip form, with the values it was saved with.
  if (beleg.source === 'travel' && beleg.raw_json) {
    const vorlage = leseFahrt(beleg.raw_json)
    if (vorlage) {
      return (
        <Rahmen titel={beleg.merchant || 'Fahrt'} zurueck={`/g/${id}`}>
          <FahrtRechner gruppeId={id} snapshot={data} vorlage={vorlage} belegId={beleg.id} />
        </Rahmen>
      )
    }
  }

  return (
    <Rahmen titel={beleg.merchant || 'Beleg'} zurueck={`/g/${id}`}>
      <BelegEditor gruppeId={id} snapshot={data} start={alsEntwurf(beleg)} />
    </Rahmen>
  )
}

/** Stored by the trip form itself, so a malformed one just falls back. */
function leseFahrt(roh: string): TravelSnapshot | null {
  try {
    const daten = JSON.parse(roh) as TravelSnapshot
    return typeof daten.distanceKm === 'number' ? daten : null
  } catch {
    return null
  }
}
