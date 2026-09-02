# quitt

Ausgaben zwischen Freunden aufteilen — Bon rein, Häkchen dran, fertig.

quitt rechnet aus, wer wem am Ende wie viel schuldet, und zeigt die kleinste
Anzahl an Ausgleichszahlungen. Kein Login, keine Konten, keine E-Mail: der
Zugang zu einer Gruppe hängt an einem 32-stelligen Token im Sync-Link.

## Stack

| Baustein    | Wahl                                            |
| ----------- | ----------------------------------------------- |
| Frontend    | React 18 · Vite 6 · TypeScript · Tailwind v4    |
| API         | Cloudflare Worker (`worker/`) mit Static Assets  |
| Datenbank   | Cloudflare D1 (SQLite), Migrationen im Repo      |
| Cache       | Cloudflare KV (Wechselkurse, einmal täglich)     |
| Validierung | zod                                              |
| Tests       | Vitest (nur der Rechenkern)                      |

Schriften liegen selbst gehostet unter `public/fonts` — zur Laufzeit geht kein
Request an Google Fonts.

## Erstes Setup bei Cloudflare

quitt läuft als **Worker mit Static Assets**: ein einziger Worker bedient
`/api/*`, alles andere kommt aus dem gebauten `dist/`. Ein unbekannter Pfad
fällt auf `index.html` zurück, damit ein tiefer Link wie
`/g/<id>/salden` funktioniert.

1. **D1-Datenbank anlegen**

   ```sh
   npx wrangler d1 create quitt
   ```

   Die zurückgegebene `database_id` in `wrangler.toml` eintragen — sie ersetzt
   `PLATZHALTER_D1_ID`. Solange der Platzhalter drinsteht, bricht der Deploy
   mit einer Fehlermeldung ab, statt eine kaputte Version live zu stellen.

2. **KV-Namespace für die Wechselkurse anlegen**

   ```sh
   npx wrangler kv namespace create FX
   ```

   Die `id` ersetzt `PLATZHALTER_KV_ID`.

3. **Migrationen fahren**

   ```sh
   npm run db:remote     # gegen die echte D1
   npm run db:local      # gegen die lokale Kopie zum Entwickeln
   ```

4. **Worker mit dem Repo verbinden**

   Im Dashboard unter *Workers & Pages → dein Worker → Settings → Build*:

   | Feld           | Wert                  |
   | -------------- | --------------------- |
   | Branch         | `main`                |
   | Build command  | leer lassen           |
   | Deploy command | `npx wrangler deploy` |

   Der Build braucht kein eigenes Feld: `wrangler.toml` enthält
   `[build] command = "npm run build"`, das läuft vor jedem Upload. Deshalb
   scheiterte der erste Versuch — es gab kein `dist/`, weil nie gebaut wurde.

   `npx wrangler versions upload` funktioniert auch, stellt die Version aber
   nur bereit, statt sie live zu schalten. Für „Push auf `main` = live" ist
   `npx wrangler deploy` das richtige Kommando.

   D1 und KV kommen aus `wrangler.toml`, im Dashboard ist dafür nichts zu tun.

Ab dann gilt: Push auf `main` = Deploy.

## Entwickeln

```sh
npm install
npm run dev         # Vite auf :5173, /api wird auf :8787 weitergereicht
npm run worker:dev  # Worker mit D1 + KV auf :8787 (zweites Terminal)
npm test            # Rechenkern
npm run typecheck
```

`npm run worker:dev` baut vorher automatisch, serviert also den letzten
Build-Stand. Zum Arbeiten an der Oberfläche ist `npm run dev` schneller — es
reicht `/api` an den Worker weiter.

## Was drin ist

- **Gruppen und Personen** — Personen sind reine Labels, ohne Konto und ohne
  E-Mail. Wer schon Belege bezahlt hat, wird beim Entfernen archiviert statt
  gelöscht, damit der Verlauf heil bleibt.
- **Belege** manuell, als Fahrt oder per JSON-Import. Vier Aufteilungsmodi
  (gleich, Anteile, Prozent, feste Beträge) mit Live-Vorschau.
- **Fahrtkosten-Rechner** — Strecke mal Satz, Hin-und-zurück, Zusatzkosten wie
  Maut oder Parken. Erzeugt einen gewöhnlichen Beleg mit Kategorie
  `transport`, damit eine Fahrt ohne Sonderfall durch Salden, Netting, Budget
  und Export läuft.
- **Salden und Ausgleich** mit zwei Verfahren: Dreiecke auflösen (die
  wenigsten Zahlungen) oder nur direkt (niemand zahlt an Unbeteiligte).
- **Budget** optional, mit Farbschwellen und Hochrechnung. Ohne Budget gibt es
  die Leiste gar nicht.
- **Auswertung** pro Person, Kategorie und Monat, plus Duplikat-Erkennung,
  wiederkehrende Kosten und CSV-Export.
- **Sync ohne Login** über einen Link mit 32-stelligem Token, optional mit PIN.

## Aufbau

```
src/core/        Rechenkern — keine Abhängigkeit zu React oder D1
                 split · allocate · balance · settle · travel · budget · statistik
src/components/  Papiersorten, Knöpfe, Personen, Sheets
src/features/    Fachliche Bildschirme: beleg, fahrt, import, budget
src/routes/      Seiten
src/lib/         Intl-Formatierung, IDs, Farben
worker/          Worker: index.ts serviert Assets, router.ts die API
migrations/      Nummerierte SQL-Migrationen
docs/            Verbindliches Design-Dokument
```

## Zwei Regeln, die nie gebrochen werden

1. Alle Geldbeträge sind Integer in der kleinsten Währungseinheit. Die einzige
   Fließkommazahl im System ist `fx_rate_to_base`.
2. Der Wechselkurs wird pro Beleg eingefroren. Eine alte Abrechnung ändert sich
   nie rückwirkend, weil sich der Tageskurs bewegt hat.
