import { describe, expect, it } from 'vitest'
import { importPrompt, kategorieAus, parseImport } from './parser'

/**
 * The parser has to cope with what a language model actually returns, not
 * with what it was told to return.
 */

const GUELTIG = {
  schema: 'quitt.receipt.v1',
  merchant: 'REWE',
  date: '2026-09-01',
  currency: 'EUR',
  items: [
    { name: 'BIO MUESLI 500G', name_clean: 'Bio-Müsli 500 g', qty: 1, total: 349, kind: 'item', category: 'lebensmittel', suggested_for: [] },
    { name: 'HAFERMILCH', name_clean: 'Hafermilch', qty: 2, total: 238, kind: 'item', category: 'getraenke', suggested_for: [] },
  ],
  subtotal: 587,
  tax: 0,
  tip: 0,
  deposit: 0,
  discounts: 0,
  total: 587,
  balanced: true,
  confidence: 0.95,
}

describe('JSON-Import', () => {
  it('liest sauberes JSON', () => {
    const ergebnis = parseImport(JSON.stringify(GUELTIG))
    expect(ergebnis.ok).toBe(true)
    if (!ergebnis.ok) return

    expect(ergebnis.daten.merchant).toBe('REWE')
    expect(ergebnis.daten.items).toHaveLength(2)
    expect(ergebnis.daten.items[0]!.total).toBe(349)
    expect(ergebnis.warnung).toBeNull()
  })

  it('streift Markdown-Codefences ab', () => {
    const ergebnis = parseImport('```json\n' + JSON.stringify(GUELTIG) + '\n```')
    expect(ergebnis.ok).toBe(true)
  })

  it('streift Gerede vor und nach dem JSON ab', () => {
    const ergebnis = parseImport(
      'Klar, hier ist das JSON:\n' + JSON.stringify(GUELTIG) + '\nSag Bescheid, wenn du mehr brauchst.',
    )
    expect(ergebnis.ok).toBe(true)
  })

  it('nimmt Komma als Dezimaltrennzeichen', () => {
    const ergebnis = parseImport(
      JSON.stringify({ ...GUELTIG, items: [{ name: 'Milch', total: '3,49' }], total: '3,49' }),
    )
    expect(ergebnis.ok).toBe(true)
    if (!ergebnis.ok) return
    expect(ergebnis.daten.items[0]!.total).toBe(349)
    expect(ergebnis.daten.total).toBe(349)
  })

  it('nimmt total als Zahl oder als String', () => {
    const alsZahl = parseImport(JSON.stringify({ ...GUELTIG, total: 587 }))
    const alsText = parseImport(JSON.stringify({ ...GUELTIG, total: '587' }))
    expect(alsZahl.ok && alsZahl.daten.total).toBe(587)
    expect(alsText.ok && alsText.daten.total).toBe(587)
  })

  it('versteht Tausenderpunkte in beiden Schreibweisen', () => {
    const deutsch = parseImport(JSON.stringify({ ...GUELTIG, total: '1.234,56' }))
    const englisch = parseImport(JSON.stringify({ ...GUELTIG, total: '1,234.56' }))
    expect(deutsch.ok && deutsch.daten.total).toBe(123456)
    expect(englisch.ok && englisch.daten.total).toBe(123456)
  })

  it('fuellt fehlende optionale Felder mit 0 oder null', () => {
    const ergebnis = parseImport(JSON.stringify({ items: [{ name: 'X', total: 100 }] }))
    expect(ergebnis.ok).toBe(true)
    if (!ergebnis.ok) return

    expect(ergebnis.daten.tax).toBe(0)
    expect(ergebnis.daten.tip).toBe(0)
    expect(ergebnis.daten.merchant).toBeNull()
    expect(ergebnis.daten.date).toBeNull()
    expect(ergebnis.daten.currency).toBe('EUR')
  })

  it('verwirft ein unbrauchbares Datum, statt es zu uebernehmen', () => {
    const ergebnis = parseImport(JSON.stringify({ ...GUELTIG, date: '01.09.2026' }))
    expect(ergebnis.ok && ergebnis.daten.date).toBeNull()
  })

  it('warnt bei balanced false, laesst aber durch', () => {
    const ergebnis = parseImport(JSON.stringify({ ...GUELTIG, balanced: false }))
    expect(ergebnis.ok).toBe(true)
    if (!ergebnis.ok) return
    expect(ergebnis.warnung).toContain('geht laut Vorlage nicht auf')
  })

  it('warnt, wenn die Summen nicht aufgehen', () => {
    const ergebnis = parseImport(JSON.stringify({ ...GUELTIG, subtotal: 587, tip: 100, total: 587 }))
    expect(ergebnis.ok).toBe(true)
    if (!ergebnis.ok) return
    expect(ergebnis.warnung).toContain('6,87')
  })

  it('meldet ungueltiges JSON mit Zeilennummer statt Stacktrace', () => {
    const kaputt = '{\n  "merchant": "REWE",\n  "items": [,]\n}'
    const ergebnis = parseImport(kaputt)

    expect(ergebnis.ok).toBe(false)
    if (ergebnis.ok) return
    expect(ergebnis.nachricht).not.toContain('JSON.parse')
    expect(ergebnis.nachricht.length).toBeGreaterThan(0)
    expect(ergebnis.zeile).toBe(3)
  })

  it('meldet abgeschnittenes JSON verstaendlich', () => {
    const ergebnis = parseImport('{"merchant": "REWE", "items": [')
    expect(ergebnis.ok).toBe(false)
    if (ergebnis.ok) return
    expect(ergebnis.nachricht).toBe('Das JSON hört mitten drin auf')
  })

  it('meldet leere Eingabe', () => {
    const ergebnis = parseImport('   ')
    expect(ergebnis.ok).toBe(false)
    if (ergebnis.ok) return
    expect(ergebnis.nachricht).toBe('Da ist kein Text zum Einlesen')
  })

  it('rundet Euro-Betraege, die das Modell falsch als Kommazahl geschickt hat', () => {
    // A model that wrote 3.49 instead of 349 must not become 3 cents.
    const ergebnis = parseImport(JSON.stringify({ ...GUELTIG, items: [{ name: 'X', total: 3.49 }] }))
    expect(ergebnis.ok && ergebnis.daten.items[0]!.total).toBe(3)
  })

  it('normalisiert unbekannte Kategorien auf sonstiges', () => {
    expect(kategorieAus('lebensmittel')).toBe('lebensmittel')
    expect(kategorieAus('Süßigkeiten')).toBe('sonstiges')
    expect(kategorieAus(null)).toBeNull()
  })

  it('setzt Mitglieder und Basiswaehrung in den Prompt ein', () => {
    const prompt = importPrompt(['Jonas', 'Patrick'], 'CHF')
    expect(prompt).toContain('Bekannte Personen dieser Gruppe: Jonas, Patrick')
    expect(prompt).toContain('"currency": "CHF"')
    expect(prompt).not.toContain('{{MITGLIEDER}}')
    expect(prompt).not.toContain('{{BASISWAEHRUNG}}')
  })

  it('liest einen fremdsprachigen Bon mit Originalnamen', () => {
    const ergebnis = parseImport(
      JSON.stringify({
        merchant: 'Migros',
        currency: 'CHF',
        items: [{ name: 'RÜEBLI', name_clean: 'Karotten', total: 240, kind: 'item' }],
        total: 240,
      }),
    )
    expect(ergebnis.ok).toBe(true)
    if (!ergebnis.ok) return
    expect(ergebnis.daten.currency).toBe('CHF')
    expect(ergebnis.daten.items[0]!.name).toBe('RÜEBLI')
    expect(ergebnis.daten.items[0]!.name_clean).toBe('Karotten')
  })
})
