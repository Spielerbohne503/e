# quitt

Ausgaben zwischen Freunden aufteilen — Bon rein, Häkchen dran, fertig.

quitt rechnet aus, wer wem am Ende wie viel schuldet, und zeigt die kleinste
Anzahl an Ausgleichszahlungen. Kein Login, keine Konten, keine E-Mail: der
Zugang zu einer Gruppe hängt an einem 32-stelligen Token im Sync-Link.

## Stack

| Baustein    | Wahl                                            |
| ----------- | ----------------------------------------------- |
| Frontend    | React 18 · Vite 6 · TypeScript · Tailwind v4    |
| API         | Cloudflare Pages Functions (`/functions/api`)    |
| Datenbank   | Cloudflare D1 (SQLite), Migrationen im Repo      |
| Cache       | Cloudflare KV (Wechselkurse, einmal täglich)     |
| Validierung | zod                                              |
| Tests       | Vitest (nur der Rechenkern)                      |

Schriften liegen selbst gehostet unter `public/fonts` — zur Laufzeit geht kein
Request an Google Fonts.

## Erstes Setup bei Cloudflare

Diese Schritte laufen einmal im Cloudflare-Dashboard bzw. lokal mit `wrangler`.

1. **D1-Datenbank anlegen**

   ```sh
   npx wrangler d1 create quitt
   ```

   Die zurückgegebene `database_id` in `wrangler.toml` unter
   `[[d1_databases]]` eintragen (ersetzt `PLATZHALTER_D1_ID`).

2. **KV-Namespace für die Wechselkurse anlegen**

   ```sh
   npx wrangler kv namespace create FX
   ```

   Die `id` in `wrangler.toml` unter `[[kv_namespaces]]` eintragen
   (ersetzt `PLATZHALTER_KV_ID`).

3. **Migrationen fahren**

   ```sh
   npm run db:remote     # gegen die echte D1
   npm run db:local      # gegen die lokale Kopie zum Entwickeln
   ```

4. **Pages-Projekt mit dem Repo verbinden**

   Im Dashboard unter *Workers & Pages → Create → Pages → Connect to Git*:

   | Feld              | Wert          |
   | ----------------- | ------------- |
   | Production branch | `main`        |
   | Build command     | `npm run build` |
   | Output directory  | `dist`        |

   Danach unter *Settings → Functions* die Bindings setzen:
   `DB` → die D1-Datenbank, `FX` → der KV-Namespace.

Ab dann gilt: Push auf `main` = Deploy.

## Entwickeln

```sh
npm install
npm run dev        # Vite auf :5173, /api wird auf :8788 weitergereicht
npm run pages:dev  # Wrangler mit D1 + KV auf :8788 (in einem zweiten Terminal)
npm test           # Rechenkern
npm run typecheck
```

## Aufbau

```
src/core/        Rechenkern — keine Abhängigkeit zu React oder D1
src/components/  Papiersorten, Knöpfe, Personen, Sheets
src/features/    Fachliche Bildschirme
src/routes/      Seiten
src/lib/         Intl-Formatierung, IDs, Farben
functions/api/   Pages Functions
migrations/      Nummerierte SQL-Migrationen
docs/            Verbindliches Design-Dokument
```

## Zwei Regeln, die nie gebrochen werden

1. Alle Geldbeträge sind Integer in der kleinsten Währungseinheit. Die einzige
   Fließkommazahl im System ist `fx_rate_to_base`.
2. Der Wechselkurs wird pro Beleg eingefroren. Eine alte Abrechnung ändert sich
   nie rückwirkend, weil sich der Tageskurs bewegt hat.
