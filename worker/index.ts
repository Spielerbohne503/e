import type { Env } from './lib/http'
import { datenbankFehlt } from './lib/http'
import { behandleApi, behandleFx } from './router'

/**
 * The Worker entry point.
 *
 * Everything under /api is the app's own API; everything else is the built
 * single-page app, served from the static asset store. The SPA fallback is
 * configured in wrangler.toml, so a deep link like /g/<id>/salden gets
 * index.html and React Router takes it from there.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      try {
        // Whether the backend is set up at all. No token, no database, so the
        // app can ask before it tries anything that would fail.
        if (url.pathname === '/api/status') {
          return new Response(JSON.stringify({ bereit: Boolean(env.DB), kurse: Boolean(env.FX) }), {
            headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
          })
        }

        // Rates need neither the database nor a token, so they answer even
        // while the rest is still waiting to be set up.
        if (url.pathname === '/api/fx') return await behandleFx(request, env)

        // Deployed before the database exists: answer with instructions rather
        // than an internal error, so the page can explain what is missing.
        if (!env.DB) return datenbankFehlt()

        return await behandleApi(request, { ...env, DB: env.DB })
      } catch (e) {
        // Never leak a stack trace; the message stays factual.
        console.error('API-Fehler', e)
        return new Response(JSON.stringify({ fehler: 'Da ist etwas schiefgegangen' }), {
          status: 500,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        })
      }
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
