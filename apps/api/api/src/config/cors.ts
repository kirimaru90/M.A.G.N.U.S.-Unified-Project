// Build the CORS options from the configured allow-list.
//
// Deployed behind the edge proxy the apps call /api same-origin, so no allow-list
// is needed. With an EMPTY list we disable cross-origin access (`origin: false`)
// rather than allowing `*`: same-origin requests are unaffected (the browser
// needs no CORS headers for them), no permissive wildcard is emitted, and a stray
// cross-origin caller is rejected. A NON-EMPTY list re-enables exactly those
// origins for a future cross-origin client — no code change required.
//
// The return type is intentionally inferred (a plain object literal) so it stays
// assignable to the Fastify adapter's enableCors options without importing a
// conflicting CorsOptions variant.
export function buildCorsOptions(origins: string[]) {
  return {
    origin: origins.length > 0 ? origins : (false as const),
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  };
}
