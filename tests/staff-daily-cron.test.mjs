import assert from "node:assert/strict";
import test from "node:test";
import handler from "../api/staff-daily-digest.js";

function response() {
  return {
    statusCode: 200,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("cron refuses unauthenticated and unconfigured calls without invoking Supabase", async () => {
  const before = { ...process.env };
  const fetchBefore = globalThis.fetch;
  let calls = 0;
  try {
    process.env.CRON_SECRET = "cron-test-secret";
    delete process.env.DIGEST_CRON_SECRET;
    globalThis.fetch = async () => { calls += 1; throw new Error("unexpected fetch"); };
    const unauthorized = response();
    await handler({ method: "GET", headers: {} }, unauthorized);
    assert.equal(unauthorized.statusCode, 401);
    const missing = response();
    await handler({ method: "GET", headers: { authorization: "Bearer cron-test-secret" } }, missing);
    assert.equal(missing.statusCode, 503);
    assert.equal(calls, 0);
  } finally {
    process.env = before;
    globalThis.fetch = fetchBefore;
  }
});

test("cron invokes digest once with separate server-side secrets", async () => {
  const before = { ...process.env };
  const fetchBefore = globalThis.fetch;
  try {
    process.env.CRON_SECRET = "cron-test-secret";
    process.env.DIGEST_CRON_SECRET = "digest-test-secret";
    process.env.SUPABASE_DIGEST_API_KEY = "test-publishable-key";
    process.env.VITE_SUPABASE_URL = "https://testproject.supabase.co";
    let calls = 0;
    globalThis.fetch = async (url, options) => {
      calls += 1;
      assert.equal(String(url), "https://testproject.supabase.co/functions/v1/staff-daily-digest");
      assert.equal(options.method, "POST");
      assert.equal(options.headers.apikey, "test-publishable-key");
      assert.equal(options.headers["x-digest-secret"], "digest-test-secret");
      assert.equal(options.body, "{}");
      return { ok: true, status: 200, json: async () => ({ ok: true, sent: 2, skipped: 0 }) };
    };
    const res = response();
    await handler({ method: "GET", headers: { authorization: "Bearer cron-test-secret" } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: true, sent: 2, skipped: 0 });
    assert.equal(calls, 1);
  } finally {
    process.env = before;
    globalThis.fetch = fetchBefore;
  }
});
