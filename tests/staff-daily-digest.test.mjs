import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { buildStaffDigests, emailHtml } from "../supabase/functions/staff-daily-digest/digest.ts";

test("simulates Year 4 and Year 5 reminder emails without contacting Gmail", () => {
  const now = Date.parse("2026-09-20T06:00:00Z");
  const entries = [
    { id: "year4-overdue", enrollment_id: "y4", student_id: "student4", activity_type: "same-code", activity_date: "2026-09-17", submitted_at: "2026-09-17T06:00:00Z", selected_approver_email: "staff@example.test" },
    { id: "year5-overdue", enrollment_id: "y5", student_id: "student5", activity_type: "same-code", activity_date: "2026-09-18", submitted_at: "2026-09-18T05:00:00Z", selected_approver_email: "staff@example.test" },
    { id: "year4-fresh", enrollment_id: "y4", student_id: "student4", activity_type: "same-code", activity_date: "2026-09-20", submitted_at: "2026-09-20T05:00:00Z", selected_approver_email: "staff@example.test" },
    { id: "archived", enrollment_id: "archived", student_id: "student4", activity_type: "same-code", activity_date: "2026-09-17", submitted_at: "2026-09-17T06:00:00Z", selected_approver_email: "staff@example.test" },
    { id: "inactive-staff", enrollment_id: "y4", student_id: "student4", activity_type: "same-code", activity_date: "2026-09-17", submitted_at: "2026-09-17T06:00:00Z", selected_approver_email: "inactive@example.test" },
  ];
  const enrollments = new Map([
    ["y4", { id: "y4", curriculum_id: "curriculum4", class_year: 4 }],
    ["y5", { id: "y5", curriculum_id: "curriculum5", class_year: 5 }],
  ]);
  const staff = new Map([["staff@example.test", "อาจารย์ทดสอบ"]]);
  const students = new Map([["student4", "นักศึกษา 4"], ["student5", "นักศึกษา 5 <script>"]]);
  const activities = new Map([
    ["curriculum4:same-code", "กิจกรรม Year 4"],
    ["curriculum5:same-code", "กิจกรรม Year 5"],
  ]);

  const plannedEmails = buildStaffDigests(entries, enrollments, staff, students, activities, now);
  assert.equal(plannedEmails.size, 1);
  const items = plannedEmails.get("staff@example.test");
  assert.deepEqual(items.map((item) => [item.entryId, item.classYear, item.activity]), [
    ["year4-overdue", 4, "กิจกรรม Year 4"],
    ["year5-overdue", 5, "กิจกรรม Year 5"],
  ]);
  assert.deepEqual(items.map((item) => item.waiting), ["72 ชั่วโมง", "49 ชั่วโมง"]);

  const html = emailHtml(staff.get("staff@example.test"), items, "https://example.test/logbook");
  assert.match(html, /Year 4/);
  assert.match(html, /Year 5/);
  assert.match(html, /กิจกรรม Year 4/);
  assert.match(html, /กิจกรรม Year 5/);
  assert.match(html, /นักศึกษา 5 &lt;script&gt;/);
  assert.doesNotMatch(html, /<script>|HN\s*\d|diagnosis ของ/);
  assert.match(html, /https:\/\/example.test\/logbook/);
});

test("simulates separate Year 4 and Year 5 emails for different Staff", () => {
  const now = Date.parse("2026-09-20T06:00:00Z");
  const entries = [
    { id: "y4-entry", enrollment_id: "y4", student_id: "student4", activity_type: "activity4", activity_date: "2026-09-17", submitted_at: "2026-09-17T06:00:00Z", selected_approver_email: "staff4@example.test" },
    { id: "y5-entry", enrollment_id: "y5", student_id: "student5", activity_type: "activity5", activity_date: "2026-09-17", submitted_at: "2026-09-17T06:00:00Z", selected_approver_email: "staff5@example.test" },
  ];
  const enrollments = new Map([
    ["y4", { id: "y4", curriculum_id: "curriculum4", class_year: 4 }],
    ["y5", { id: "y5", curriculum_id: "curriculum5", class_year: 5 }],
  ]);
  const staff = new Map([["staff4@example.test", "Staff 4"], ["staff5@example.test", "Staff 5"]]);
  const students = new Map([["student4", "Student 4"], ["student5", "Student 5"]]);
  const activities = new Map([["curriculum4:activity4", "Activity 4"], ["curriculum5:activity5", "Activity 5"]]);
  const plannedEmails = buildStaffDigests(entries, enrollments, staff, students, activities, now);
  assert.equal(plannedEmails.size, 2);
  const year4Email = emailHtml(staff.get("staff4@example.test"), plannedEmails.get("staff4@example.test"), "https://example.test");
  const year5Email = emailHtml(staff.get("staff5@example.test"), plannedEmails.get("staff5@example.test"), "https://example.test");
  assert.match(year4Email, /Year 4<\/td>/);
  assert.doesNotMatch(year4Email, /Year 5<\/td>/);
  assert.match(year5Email, /Year 5<\/td>/);
  assert.doesNotMatch(year5Email, /Year 4<\/td>/);
});

test("Edge Function dry run counts both years and never writes or calls Gmail", async () => {
  const source = await readFile(new URL("../supabase/functions/staff-daily-digest/index.ts", import.meta.url), "utf8");
  const executable = stripTypeScriptTypes(source.replace(/^import .*\n/gm, ""), { mode: "strip" });
  const now = new Date(Date.now() - 72 * 3_600_000).toISOString();
  const tables = {
    student_enrollments: [
      { id: "enrollment4", curriculum_id: "curriculum4", status: "active", curriculum: { class_year: 4, status: "published" } },
      { id: "enrollment5", curriculum_id: "curriculum5", status: "active", curriculum: { class_year: 5, status: "published" } },
    ],
    year4_logbook_entries: [
      { id: "entry4", student_id: "student4", enrollment_id: "enrollment4", activity_type: "operation", activity_date: "2026-09-17", submitted_at: now, selected_approver_email: "staff@example.test", status: "submitted" },
      { id: "entry5", student_id: "student5", enrollment_id: "enrollment5", activity_type: "operation", activity_date: "2026-09-17", submitted_at: now, selected_approver_email: "staff@example.test", status: "submitted" },
    ],
    profiles: [{ id: "student4", full_name: "นักศึกษา 4" }, { id: "student5", full_name: "นักศึกษา 5" }],
    curriculum_activities: [
      { curriculum_id: "curriculum4", activity_code: "operation", title_th: "กิจกรรมปี 4", active: true },
      { curriculum_id: "curriculum5", activity_code: "operation", title_th: "กิจกรรมปี 5", active: true },
    ],
    user_directory: [{ email: "staff@example.test", full_name: "อาจารย์ทดสอบ", role: "staff", active: true }],
    staff_digest_deliveries: [],
  };
  let writes = 0;
  let networkCalls = 0;
  const lookup = (row, path) => path.split(".").reduce((value, key) => value?.[key], row);
  const createClient = () => ({ from(table) {
    const filters = [];
    const query = {
      select() { return query; },
      eq(field, value) { filters.push((row) => lookup(row, field) === value); return query; },
      in(field, values) { filters.push((row) => values.includes(lookup(row, field))); return query; },
      not(field, _operator, value) { filters.push((row) => lookup(row, field) !== value); return query; },
      lte(field, value) { filters.push((row) => lookup(row, field) <= value); return query; },
      insert() { writes += 1; throw new Error("dry run must not write"); },
      update() { writes += 1; throw new Error("dry run must not write"); },
      then(resolve, reject) { return Promise.resolve({ data: (tables[table] || []).filter((row) => filters.every((filter) => filter(row))), error: null }).then(resolve, reject); },
    };
    return query;
  } });
  let handler;
  const deno = { env: { get: (key) => ({ DIGEST_CRON_SECRET: "test-secret", SUPABASE_URL: "https://example.test", SUPABASE_SERVICE_ROLE_KEY: "test-key" })[key] }, serve: (callback) => { handler = callback; } };
  new Function("createClient", "buildStaffDigests", "emailHtml", "Deno", "fetch", executable)(
    createClient, buildStaffDigests, emailHtml, deno, async () => { networkCalls += 1; throw new Error("dry run must not access Gmail"); },
  );
  const response = await handler(new Request("https://example.test/functions/v1/staff-daily-digest", {
    method: "POST", headers: { "x-digest-secret": "test-secret", "content-type": "application/json" }, body: JSON.stringify({ dryRun: true }),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true, dryRun: true, deliveryDate: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
    sent: 0, wouldSend: 1, byYear: { "4": 1, "5": 1 },
  });
  assert.equal(writes, 0);
  assert.equal(networkCalls, 0);

  tables.staff_digest_deliveries.push({ staff_email: "staff@example.test", delivery_date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()) });
  const repeatResponse = await handler(new Request("https://example.test/functions/v1/staff-daily-digest", {
    method: "POST", headers: { "x-digest-secret": "test-secret", "content-type": "application/json" }, body: JSON.stringify({ dryRun: true }),
  }));
  const repeat = await repeatResponse.json();
  assert.equal(repeat.wouldSend, 0);
  assert.deepEqual(repeat.byYear, { "4": 0, "5": 0 });
  assert.equal(writes, 0);
  assert.equal(networkCalls, 0);
});

test("Gmail diagnostic checks OAuth send scope without sending an email", async () => {
  const source = await readFile(new URL("../supabase/functions/staff-daily-digest/index.ts", import.meta.url), "utf8");
  const executable = stripTypeScriptTypes(source.replace(/^import .*\n/gm, ""), { mode: "strip" });
  let handler;
  const names = [];
  const deno = { env: { get: (key) => ({
    DIGEST_CRON_SECRET: "test-secret", GOOGLE_GMAIL_CLIENT_ID: "client", GOOGLE_GMAIL_CLIENT_SECRET: "secret",
    GOOGLE_GMAIL_REFRESH_TOKEN: "refresh", GOOGLE_GMAIL_FROM_EMAIL: "sender@example.test",
  })[key] }, serve: (callback) => { handler = callback; } };
  const fetch = async (url) => {
    const address = String(url);
    names.push(new URL(address).hostname);
    if (address === "https://oauth2.googleapis.com/token") return { ok: true, json: async () => ({ access_token: "test-access" }) };
    if (address.startsWith("https://oauth2.googleapis.com/tokeninfo?")) return { ok: true, json: async () => ({ scope: "https://www.googleapis.com/auth/gmail.send" }) };
    throw new Error("unexpected Gmail send");
  };
  new Function("createClient", "buildStaffDigests", "emailHtml", "Deno", "fetch", executable)(
    () => { throw new Error("diagnostic must not query database"); }, buildStaffDigests, emailHtml, deno, fetch,
  );
  const result = await handler(new Request("https://example.test/functions/v1/staff-daily-digest", {
    method: "POST", headers: { "x-digest-secret": "test-secret" }, body: JSON.stringify({ checkGmail: true }),
  }));
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { ok: true, gmailSendScope: true, senderConfigured: true });
  assert.deepEqual(names, ["oauth2.googleapis.com", "oauth2.googleapis.com"]);
});

test("Gmail diagnostic reports only a safe OAuth error code", async () => {
  const source = await readFile(new URL("../supabase/functions/staff-daily-digest/index.ts", import.meta.url), "utf8");
  const executable = stripTypeScriptTypes(source.replace(/^import .*\n/gm, ""), { mode: "strip" });
  let handler;
  const deno = { env: { get: (key) => ({
    DIGEST_CRON_SECRET: "test-secret", GOOGLE_GMAIL_CLIENT_ID: "client", GOOGLE_GMAIL_CLIENT_SECRET: "secret",
    GOOGLE_GMAIL_REFRESH_TOKEN: "refresh", GOOGLE_GMAIL_FROM_EMAIL: "sender@example.test",
  })[key] }, serve: (callback) => { handler = callback; } };
  const fetch = async (url) => {
    assert.equal(String(url), "https://oauth2.googleapis.com/token");
    return { ok: false, json: async () => ({ error: "invalid_grant", error_description: "private provider detail" }) };
  };
  new Function("createClient", "buildStaffDigests", "emailHtml", "Deno", "fetch", executable)(
    () => { throw new Error("diagnostic must not query database"); }, buildStaffDigests, emailHtml, deno, fetch,
  );
  const result = await handler(new Request("https://example.test/functions/v1/staff-daily-digest", {
    method: "POST", headers: { "x-digest-secret": "test-secret" }, body: JSON.stringify({ checkGmail: true }),
  }));
  assert.equal(result.status, 502);
  assert.deepEqual(await result.json(), { ok: false, error: "Google OAuth token exchange failed", oauthError: "invalid_grant" });
});
