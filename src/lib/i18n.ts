import { useSyncExternalStore } from 'react'

/**
 * German and English.
 *
 * The app's voice is deliberately loose and informal: short sentences, no
 * "bitte", no "erfolgreich", no exclamation marks in system messages. The
 * English strings keep the same register rather than turning formal.
 */

export type Sprache = 'de' | 'en'

const SCHLUESSEL = 'quitt.sprache'

const TEXTE = {
  de: {
    // Navigation and shell
    'app.name': 'quitt',
    'app.zurueck': 'Zurück',
    'app.einstellungen': 'Einstellungen',
    'app.schliessen': 'Schließen',
    'app.laedt': 'Lädt',
    'app.speichern': 'Speichern',
    'app.wirdGespeichert': 'Wird gespeichert',
    'app.uebernehmen': 'Übernehmen',
    'app.loeschen': 'Löschen',
    'app.hinzufuegen': 'Hinzufügen',

    // Groups
    'gruppe.neu': 'Neue Gruppe',
    'gruppe.anlegen': 'Gruppe anlegen',
    'gruppe.leer': 'Noch keine Gruppe. Leg eine an, dann kann es losgehen.',
    'gruppe.name': 'Wie heißt die Gruppe?',
    'gruppe.werDabei': 'Wer ist dabei?',
    'gruppe.personenHinweis': 'Namen reichen. Niemand braucht ein Konto, niemand bekommt eine E-Mail.',
    'gruppe.nochJemand': 'Noch jemand',

    // Receipts
    'beleg.neu': 'Neuer Beleg',
    'beleg.erfassen': 'Beleg erfassen',
    'beleg.leer': 'Noch keine Belege. Erfass den ersten, dann rechnet quitt mit.',
    'beleg.wo': 'Wo?',
    'beleg.wann': 'Wann?',
    'beleg.werGezahlt': 'Wer hat gezahlt?',
    'beleg.summe': 'Was stand auf dem Bon?',
    'beleg.summeHinweis': 'Die Gesamtsumme, wie sie an der Kasse stand.',
    'beleg.positionen': 'Positionen',
    'beleg.offen': 'Offen',
    'beleg.anteilig': 'Anteilig',
    'beleg.wieSonst': 'wie sonst auch',
    'beleg.werTraegtWas': 'Wer trägt was',
    'beleg.notiz': 'Notiz',

    // Splitting
    'split.gleich': 'Gleich',
    'split.anteile': 'Anteile',
    'split.prozent': 'Prozent',
    'split.betraege': 'Beträge',
    'split.niemand': 'Noch niemand ausgewählt. Diese Position bleibt offen.',

    // Balances
    'salden.titel': 'Stand',
    'salden.quitt': 'Ihr seid quitt',
    'salden.keineOffenen': 'Keine offenen Posten mehr.',
    'salden.eineZahlung': 'Eine Zahlung offen',
    'salden.bezahlt': 'Bezahlt',
    'salden.ausgeglichen': 'Schon ausgeglichen',
    'salden.zuruecknehmen': 'Zurücknehmen',

    // Travel
    'fahrt.titel': 'Fahrt',
    'fahrt.von': 'Von',
    'fahrt.nach': 'Nach',
    'fahrt.strecke': 'Strecke',
    'fahrt.hinUndZurueck': 'Hin und zurück',
    'fahrt.verdoppelt': 'Verdoppelt die Strecke',
    'fahrt.satz': 'Satz pro Kilometer',
    'fahrt.werGefahren': 'Wer ist gefahren?',
    'fahrt.zusatzkosten': 'Zusatzkosten',
    'fahrt.werMit': 'Wer fährt mit?',
    'fahrt.kostet': 'Das kostet die Fahrt',
    'fahrt.proPerson': 'Pro Person',
    'fahrt.speichern': 'Fahrt speichern',

    // Sync
    'sync.titel': 'Auf mehreren Geräten',
    'sync.warnung': 'Wer den Link hat, sieht alles',
    'sync.keineVerbindung': 'Keine Verbindung',
    'sync.lesemodus': 'Du siehst den letzten Stand. Ändern geht wieder, sobald die Verbindung steht.',

    // Errors — factual, no jokes. The humour lives in the success cases.
    'fehler.allgemein': 'Da ist etwas schiefgegangen',
    'fehler.keinZugriff': 'Kein Zugriff',
    'fehler.nichtGefunden': 'Nicht gefunden',
  },

  en: {
    'app.name': 'quitt',
    'app.zurueck': 'Back',
    'app.einstellungen': 'Settings',
    'app.schliessen': 'Close',
    'app.laedt': 'Loading',
    'app.speichern': 'Save',
    'app.wirdGespeichert': 'Saving',
    'app.uebernehmen': 'Apply',
    'app.loeschen': 'Delete',
    'app.hinzufuegen': 'Add',

    'gruppe.neu': 'New group',
    'gruppe.anlegen': 'Create group',
    'gruppe.leer': 'No groups yet. Make one and you are off.',
    'gruppe.name': 'What is the group called?',
    'gruppe.werDabei': 'Who is in?',
    'gruppe.personenHinweis': 'Names are enough. Nobody needs an account, nobody gets an email.',
    'gruppe.nochJemand': 'Someone else',

    'beleg.neu': 'New receipt',
    'beleg.erfassen': 'Add receipt',
    'beleg.leer': 'No receipts yet. Add the first one and quitt takes it from there.',
    'beleg.wo': 'Where?',
    'beleg.wann': 'When?',
    'beleg.werGezahlt': 'Who paid?',
    'beleg.summe': 'What did the receipt say?',
    'beleg.summeHinweis': 'The total, as printed at the till.',
    'beleg.positionen': 'Line items',
    'beleg.offen': 'Open',
    'beleg.anteilig': 'Shared',
    'beleg.wieSonst': 'as usual',
    'beleg.werTraegtWas': 'Who carries what',
    'beleg.notiz': 'Note',

    'split.gleich': 'Equal',
    'split.anteile': 'Shares',
    'split.prozent': 'Percent',
    'split.betraege': 'Amounts',
    'split.niemand': 'Nobody selected yet. This line stays open.',

    'salden.titel': 'Standing',
    'salden.quitt': 'You are square',
    'salden.keineOffenen': 'Nothing left open.',
    'salden.eineZahlung': 'One payment open',
    'salden.bezahlt': 'Paid',
    'salden.ausgeglichen': 'Already settled',
    'salden.zuruecknehmen': 'Undo',

    'fahrt.titel': 'Trip',
    'fahrt.von': 'From',
    'fahrt.nach': 'To',
    'fahrt.strecke': 'Distance',
    'fahrt.hinUndZurueck': 'Round trip',
    'fahrt.verdoppelt': 'Doubles the distance',
    'fahrt.satz': 'Rate per kilometre',
    'fahrt.werGefahren': 'Who drove?',
    'fahrt.zusatzkosten': 'Extra costs',
    'fahrt.werMit': 'Who is riding along?',
    'fahrt.kostet': 'What the trip costs',
    'fahrt.proPerson': 'Per person',
    'fahrt.speichern': 'Save trip',

    'sync.titel': 'On several devices',
    'sync.warnung': 'Whoever has the link sees everything',
    'sync.keineVerbindung': 'No connection',
    'sync.lesemodus': 'You are seeing the last state. Editing works again once the connection is back.',

    'fehler.allgemein': 'Something went wrong',
    'fehler.keinZugriff': 'No access',
    'fehler.nichtGefunden': 'Not found',
  },
} as const

export type TextSchluessel = keyof (typeof TEXTE)['de']

function gespeicherteSprache(): Sprache {
  try {
    const roh = localStorage.getItem(SCHLUESSEL)
    if (roh === 'de' || roh === 'en') return roh
  } catch {
    // Blocked storage; fall through to the browser's preference.
  }
  return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'de'
}

let aktuell: Sprache = typeof window === 'undefined' ? 'de' : gespeicherteSprache()
const hoerer = new Set<() => void>()

export function setzeSprache(sprache: Sprache): void {
  aktuell = sprache
  try {
    localStorage.setItem(SCHLUESSEL, sprache)
  } catch {
    // Not persisting is survivable; the choice holds for this session.
  }
  document.documentElement.lang = sprache
  for (const h of hoerer) h()
}

export function sprache(): Sprache {
  return aktuell
}

/** Translates a key. Falls back to German rather than showing a raw key. */
export function t(schluessel: TextSchluessel): string {
  return TEXTE[aktuell][schluessel] ?? TEXTE.de[schluessel] ?? schluessel
}

/** Re-renders the component when the language changes. */
export function useSprache(): { sprache: Sprache; t: typeof t } {
  const aktiv = useSyncExternalStore(
    (aendern) => {
      hoerer.add(aendern)
      return () => hoerer.delete(aendern)
    },
    () => aktuell,
    () => 'de' as Sprache,
  )
  return { sprache: aktiv, t }
}
