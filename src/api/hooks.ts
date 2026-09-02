import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { api, ApiFehler } from './client'
import { merkeGruppe } from '@/lib/speicher'
import type { Snapshot } from '@/shared/api'
import { abrechnen } from '@/core/settle'
import type { Item as CoreItem, Member as CoreMember, Receipt as CoreReceipt, Settlement as CoreSettlement } from '@/core/types'

/** The polling interval from the sync design. */
const POLL_MS = 15_000

export const schluessel = {
  snapshot: (id: string) => ['snapshot', id] as const,
  revision: (id: string) => ['revision', id] as const,
}

export function useSnapshot(gruppeId: string) {
  const qc = useQueryClient()

  const abfrage = useQuery({
    queryKey: schluessel.snapshot(gruppeId),
    queryFn: () => api.snapshot(gruppeId),
    enabled: Boolean(gruppeId),
  })

  // Poll the revision, not the snapshot: a quiet group costs one integer
  // every fifteen seconds instead of the whole data set.
  const revision = useQuery({
    queryKey: schluessel.revision(gruppeId),
    queryFn: () => api.revision(gruppeId),
    enabled: Boolean(gruppeId) && abfrage.isSuccess,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
  })

  const bekannteRevision = abfrage.data?.group.revision
  const serverRevision = revision.data?.revision

  useEffect(() => {
    if (serverRevision !== undefined && bekannteRevision !== undefined && serverRevision !== bekannteRevision) {
      void qc.invalidateQueries({ queryKey: schluessel.snapshot(gruppeId) })
    }
  }, [serverRevision, bekannteRevision, gruppeId, qc])

  // Keep the local group list in step with the server's name and currency.
  useEffect(() => {
    const g = abfrage.data?.group
    if (!g) return
    merkeGruppe({ id: g.id, name: g.name, base_currency: g.base_currency })
  }, [abfrage.data?.group])

  const fehler = abfrage.error instanceof ApiFehler ? abfrage.error : null

  return {
    ...abfrage,
    /** True while the server is unreachable — the UI switches to read-only. */
    offline: fehler?.status === 0,
    brauchtPin: fehler?.brauchtPin ?? false,
    keinZugriff: fehler?.keinZugriff ?? false,
  }
}

/** Refetches the group after any write, so every screen sees the same state. */
function nachSchreiben(qc: QueryClient, gruppeId: string) {
  return () => {
    void qc.invalidateQueries({ queryKey: schluessel.snapshot(gruppeId) })
    void qc.invalidateQueries({ queryKey: schluessel.revision(gruppeId) })
  }
}

export function useGruppeAendern(gruppeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Parameters<typeof api.gruppeAendern>[1]) => api.gruppeAendern(gruppeId, body),
    onSuccess: nachSchreiben(qc, gruppeId),
  })
}

export function useMitgliedAnlegen(gruppeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { display_name: string; color: string }) => api.mitgliedAnlegen(gruppeId, body),
    onSuccess: nachSchreiben(qc, gruppeId),
  })
}

export function useMitgliedAendern(gruppeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Parameters<typeof api.mitgliedAendern>[2]) =>
      api.mitgliedAendern(gruppeId, id, body),
    onSuccess: nachSchreiben(qc, gruppeId),
  })
}

export function useMitgliedLoeschen(gruppeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.mitgliedLoeschen(gruppeId, id),
    onSuccess: nachSchreiben(qc, gruppeId),
  })
}

export function useBelegSpeichern(gruppeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: unknown }) =>
      id ? api.belegErsetzen(gruppeId, id, body) : api.belegAnlegen(gruppeId, body),
    onSuccess: nachSchreiben(qc, gruppeId),
  })
}

export function useBelegLoeschen(gruppeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.belegLoeschen(gruppeId, id),
    onSuccess: nachSchreiben(qc, gruppeId),
  })
}

export function useAusgleichAnlegen(gruppeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { from_id: string; to_id: string; amount_cents: number }) =>
      api.ausgleichAnlegen(gruppeId, body),
    onSuccess: nachSchreiben(qc, gruppeId),
  })
}

export function useAusgleichLoeschen(gruppeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.ausgleichLoeschen(gruppeId, id),
    onSuccess: nachSchreiben(qc, gruppeId),
  })
}

export function useBudgetSpeichern(gruppeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: unknown }) =>
      id ? api.budgetAendern(gruppeId, id, body) : api.budgetAnlegen(gruppeId, body),
    onSuccess: nachSchreiben(qc, gruppeId),
  })
}

export function useBudgetLoeschen(gruppeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.budgetLoeschen(gruppeId, id),
    onSuccess: nachSchreiben(qc, gruppeId),
  })
}

/* ------------------------------------------------------------------ *
 * Bridging the API shape to the calculation core
 * ------------------------------------------------------------------ */

/** The core speaks camelCase and knows nothing about the database. */
export function zuCoreDaten(snapshot: Snapshot): {
  members: CoreMember[]
  receipts: CoreReceipt[]
  settlements: CoreSettlement[]
} {
  const members: CoreMember[] = snapshot.members.map((m) => ({ id: m.id, sortOrder: m.sort_order }))

  const receipts: CoreReceipt[] = snapshot.receipts.map((r) => ({
    id: r.id,
    payerId: r.payer_id,
    currency: r.currency,
    fxRateToBase: r.fx_rate_to_base,
    totalCents: r.total_cents,
    date: r.date,
    items: r.items.map(
      (i): CoreItem => ({
        id: i.id,
        name: i.name,
        qty: i.qty,
        totalCents: i.total_cents,
        kind: i.kind,
        category: i.category,
        sortOrder: i.sort_order,
        splits: i.splits.map((s) => ({ memberId: s.member_id, mode: s.mode, value: s.value })),
      }),
    ),
  }))

  const settlements: CoreSettlement[] = snapshot.settlements.map((s) => ({
    id: s.id,
    fromId: s.from_id,
    toId: s.to_id,
    amountCents: s.amount_cents,
    settledAt: s.settled_at,
  }))

  return { members, receipts, settlements }
}

/** Balances and the payments that clear them, recomputed whenever data changes. */
export function useAbrechnung(snapshot: Snapshot | undefined) {
  return useMemo(() => {
    if (!snapshot) return null
    const { members, receipts, settlements } = zuCoreDaten(snapshot)
    return abrechnen(receipts, settlements, members, {
      baseCurrency: snapshot.group.base_currency,
      nettingMode: snapshot.group.netting_mode,
    })
  }, [snapshot])
}
