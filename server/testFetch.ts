// A pretend internet for tests: maps URLs to responses, records every request.

export type Route = Response | (() => Response) | { redirect: string; status?: number };

export function fakeFetch(routes: Record<string, Route>) {
  const calls: string[] = [];
  const impl = (async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    calls.push(url);
    const route = routes[url];
    if (!route) return new Response('not found', { status: 404 });
    if ('redirect' in route) return new Response(null, { status: route.status ?? 302, headers: { Location: route.redirect } });
    if (typeof route === 'function') return route();
    // A fresh copy each time: cancelling a clone's body would wait for the original.
    const { status, headers } = route;
    return new Response(status === 204 ? null : await route.clone().arrayBuffer(), { status, headers });
  }) as typeof fetch;
  return { impl, calls };
}

export const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1]);

export const html = (body: string, type = 'text/html; charset=utf-8') => new Response(body, { headers: { 'Content-Type': type } });
export const image = (bytes: Uint8Array<ArrayBuffer> = PNG_BYTES, type = 'image/png') => new Response(bytes, { headers: { 'Content-Type': type } });
