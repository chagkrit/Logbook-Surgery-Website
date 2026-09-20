const SUPABASE_FUNCTION = "staff-daily-digest";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ ok: false });

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ ok: false });
  }

  const projectUrl = process.env.VITE_SUPABASE_URL;
  const apiKey = process.env.SUPABASE_DIGEST_API_KEY;
  const digestSecret = process.env.DIGEST_CRON_SECRET;
  if (!projectUrl || !apiKey || !digestSecret) {
    return res.status(503).json({ ok: false, error: "Digest scheduler is not configured" });
  }
  let url;
  try {
    const parsed = new URL(projectUrl);
    if (parsed.protocol !== "https:" || !/^[a-z0-9-]+\.supabase\.co$/.test(parsed.hostname) || parsed.pathname !== "/") throw new Error("Invalid project URL");
    url = new URL(`/functions/v1/${SUPABASE_FUNCTION}`, parsed);
  } catch {
    return res.status(503).json({ ok: false, error: "Invalid Supabase project URL" });
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, apikey: apiKey, "x-digest-secret": digestSecret },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(25_000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok !== true) {
      console.error("Staff digest invocation failed", { status: response.status });
      return res.status(502).json({ ok: false, error: "Digest invocation failed" });
    }
    return res.status(200).json({ ok: true, sent: result.sent, skipped: result.skipped });
  } catch (error) {
    console.error("Staff digest invocation unavailable", { name: error?.name });
    return res.status(502).json({ ok: false, error: "Digest invocation unavailable" });
  }
}
