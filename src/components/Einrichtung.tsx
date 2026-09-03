import { Papier } from './Papier'
import { Marke } from './Marke'

/**
 * Shown when the Worker is live but the database is not set up yet.
 *
 * The app deploys before D1 exists on purpose — a red build explains nothing,
 * whereas this page says exactly which two commands are missing. It disappears
 * on its own once the bindings are there.
 */
export function Einrichtung() {
  return (
    <div className="min-h-dvh grid place-items-center px-4 py-10">
      <div className="w-full max-w-[560px] min-w-0">
        <div className="flex items-center gap-3 mb-6">
          <Marke groesse={36} />
          <h1 className="text-[28px] font-medium">quitt</h1>
        </div>

        <Papier className="p-6">
          <h2 className="text-[21px] font-medium mb-2">Fast fertig</h2>
          <p className="text-tinte-2 mb-5">
            Der Worker läuft, aber die Datenbank fehlt noch. Zwei Befehle, dann geht es los.
          </p>

          <ol className="grid gap-4">
            <li>
              <p className="font-bold mb-1.5">1. D1 und KV anlegen</p>
              <Befehl>npx wrangler login</Befehl>
              <Befehl>npm run setup:cloudflare</Befehl>
              <p className="text-sm text-tinte-2 mt-1.5">
                Legt die Datenbank an und trägt die IDs in <Code>wrangler.toml</Code> ein.
              </p>
            </li>

            <li>
              <p className="font-bold mb-1.5">2. Tabellen anlegen</p>
              <Befehl>npm run db:remote</Befehl>
            </li>

            <li>
              <p className="font-bold mb-1.5">3. Änderung pushen</p>
              <Befehl>{'git add wrangler.toml\ngit commit -m "Cloudflare-IDs"\ngit push'}</Befehl>
              <p className="text-sm text-tinte-2 mt-1.5">
                Der nächste Deploy nimmt die Bindings mit, und diese Seite verschwindet.
              </p>
            </li>
          </ol>
        </Papier>

        <p className="text-sm text-tinte-2 mt-4 text-center">
          Die Anleitung steht auch in der README.
        </p>
      </div>
    </div>
  )
}

function Befehl({ children }: { children: React.ReactNode }) {
  return (
    <pre className="font-mono text-sm bg-papier border border-strich rounded-klein px-3 py-2 mb-1.5 max-w-full overflow-x-auto whitespace-pre-wrap break-words">
      <code>{children}</code>
    </pre>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[13px] px-1 rounded bg-papier">{children}</code>
}
