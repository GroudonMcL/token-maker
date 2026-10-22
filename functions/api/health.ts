// Placeholder Pages Function so Cloudflare sets up the /functions folder.
// The image proxy endpoints (DESIGN.md §7) arrive in a later phase.
// Visit /api/health on the deployed site to check Functions are running.
export const onRequestGet: PagesFunction = () =>
  Response.json({ ok: true });
