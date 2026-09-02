import { Rahmen } from '@/components/Rahmen'
import { LeerZustand } from '@/components/Zetti'
import { Knopf } from '@/components/Knopf'

export function GruppenListe() {
  return (
    <Rahmen>
      <LeerZustand text="Noch keine Gruppe. Leg eine an, dann kann es losgehen.">
        <Knopf>Gruppe anlegen</Knopf>
      </LeerZustand>
    </Rahmen>
  )
}
