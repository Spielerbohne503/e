import type { Env } from './lib/http'
import { behandleApi } from './router'

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
        return await behandleApi(request, env)
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
