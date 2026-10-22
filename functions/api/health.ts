// Visit /api/health on the deployed site to check Functions are running.
export const onRequestGet: PagesFunction = () =>
  Response.json({ ok: true });
