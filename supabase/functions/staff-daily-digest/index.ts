import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { buildStaffDigests, emailHtml, type DigestEnrollment } from "./digest.ts";

const APP_URL = "https://logbook-surgery-website.vercel.app";
const BANGKOK_TIME_ZONE = "Asia/Bangkok";

function bangkokDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BANGKOK_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function base64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function encodeSubject(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

async function gmailAccessToken(clientId: string, clientSecret: string, refreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) throw new Error(payload.error_description || payload.error || "Google OAuth token exchange failed");
  return String(payload.access_token);
}

async function sendGmail(accessToken: string, fromEmail: string, toEmail: string, subject: string, html: string) {
  const raw = [
    `From: Surgery CMU Logbook <${fromEmail}>`,
    `To: ${toEmail}`,
    `Subject: ${encodeSubject(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    html,
  ].join("\r\n");
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: base64Url(raw) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.id) throw new Error(payload.error?.message || `Gmail API error ${response.status}`);
  return payload;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const expectedSecret = Deno.env.get("DIGEST_CRON_SECRET") || "";
  const suppliedSecret = request.headers.get("x-digest-secret") || "";
  if (!expectedSecret || suppliedSecret !== expectedSecret) return new Response("Unauthorized", { status: 401 });
  const body = await request.json().catch(() => ({}));
  const dryRun = body?.dryRun === true;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const googleClientId = Deno.env.get("GOOGLE_GMAIL_CLIENT_ID") || "";
  const googleClientSecret = Deno.env.get("GOOGLE_GMAIL_CLIENT_SECRET") || "";
  const googleRefreshToken = Deno.env.get("GOOGLE_GMAIL_REFRESH_TOKEN") || "";
  const sender = Deno.env.get("GOOGLE_GMAIL_FROM_EMAIL") || "";
  // Credential diagnostic: no database lookup, delivery record or Gmail send.
  if (body?.checkGmail === true) {
    if (!googleClientId || !googleClientSecret || !googleRefreshToken || !sender) {
      return Response.json({ ok: false, error: "Digest Gmail settings are not configured" }, { status: 503 });
    }
    try {
      const token = await gmailAccessToken(googleClientId, googleClientSecret, googleRefreshToken);
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`);
      const info = await response.json().catch(() => ({}));
      if (!response.ok || !String(info.scope || "").split(" ").includes("https://www.googleapis.com/auth/gmail.send")) {
        return Response.json({ ok: false, error: "Gmail send permission was not confirmed" }, { status: 502 });
      }
      return Response.json({ ok: true, gmailSendScope: true, senderConfigured: true });
    } catch {
      return Response.json({ ok: false, error: "Google OAuth token exchange failed" }, { status: 502 });
    }
  }
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ ok: false, error: "Digest function is not configured" }, { status: 503 });
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const deliveryDate = bangkokDate();
  // Only active enrollments in published Year 4/5 curricula are eligible.
  // Archived enrollment history must not trigger a current Staff email.
  const { data: activeEnrollments, error: enrollmentError } = await supabase
    .from("student_enrollments")
    .select("id,curriculum_id,curriculum:curricula!inner(class_year,status)")
    .eq("status", "active")
    .in("curriculum.class_year", [4, 5])
    .eq("curriculum.status", "published");
  if (enrollmentError) return Response.json({ ok: false, error: enrollmentError.message }, { status: 500 });
  const activeEnrollmentIds = (activeEnrollments || []).map((item) => item.id);
  if (!activeEnrollmentIds.length) return Response.json({ ok: true, dryRun, deliveryDate, sent: 0, skipped: 0, wouldSend: 0 });
  const enrollmentMap = new Map<string, DigestEnrollment>((activeEnrollments || []).map((item) => [item.id, {
    id: item.id, curriculum_id: item.curriculum_id, class_year: item.curriculum.class_year,
  }]));
  const { data: pendingEntries, error: entriesError } = await supabase.from("year4_logbook_entries")
    .select("id,student_id,activity_type,activity_date,submitted_at,selected_approver_email,enrollment_id")
    .in("enrollment_id", activeEnrollmentIds).eq("status", "submitted").not("selected_approver_email", "is", null).lte("submitted_at", cutoff);
  if (entriesError) return Response.json({ ok: false, error: entriesError.message }, { status: 500 });
  const entries = pendingEntries || [];
  if (!entries.length) return Response.json({ ok: true, dryRun, deliveryDate, sent: 0, skipped: 0, wouldSend: 0 });

  const studentIds = [...new Set(entries.map((item) => item.student_id))];
  const activityCodes = [...new Set(entries.map((item) => item.activity_type))];
  const [studentsResult, activitiesResult, staffResult] = await Promise.all([
    supabase.from("profiles").select("id,full_name").in("id", studentIds),
    supabase.from("curriculum_activities").select("curriculum_id,activity_code,title_th").in("activity_code", activityCodes).eq("active", true),
    supabase.from("user_directory").select("email,full_name").eq("role", "staff").eq("active", true),
  ]);
  if (studentsResult.error || activitiesResult.error || staffResult.error) {
    return Response.json({ ok: false, error: studentsResult.error?.message || activitiesResult.error?.message || staffResult.error?.message }, { status: 500 });
  }
  const studentNames = new Map((studentsResult.data || []).map((student) => [student.id, student.full_name]));
  const activityNames = new Map((activitiesResult.data || []).map((activity) => [`${activity.curriculum_id}:${activity.activity_code}`, activity.title_th]));
  const staff = new Map((staffResult.data || []).map((item) => [item.email, item.full_name]));
  const byStaff = buildStaffDigests(entries, enrollmentMap, staff, studentNames, activityNames, Date.now());
  if (dryRun) {
    const { data: existingDeliveries, error: deliveryError } = await supabase.from("staff_digest_deliveries")
      .select("staff_email").eq("delivery_date", deliveryDate);
    if (deliveryError) return Response.json({ ok: false, error: deliveryError.message }, { status: 500 });
    const alreadyHandled = new Set((existingDeliveries || []).map((delivery) => delivery.staff_email));
    const unsentDigests = [...byStaff].filter(([staffEmail]) => !alreadyHandled.has(staffEmail));
    const byYear = { "4": 0, "5": 0 };
    for (const [, items] of unsentDigests) {
      for (const item of items) byYear[String(item.classYear) as "4" | "5"] += 1;
    }
    return Response.json({ ok: true, dryRun: true, deliveryDate, sent: 0, wouldSend: unsentDigests.length, byYear });
  }
  if (!byStaff.size) return Response.json({ ok: true, deliveryDate, sent: 0, skipped: 0 });
  if (!googleClientId || !googleClientSecret || !googleRefreshToken || !sender) {
    return Response.json({ ok: false, error: "Digest Gmail settings are not configured" }, { status: 503 });
  }

  let accessToken = "";
  try { accessToken = await gmailAccessToken(googleClientId, googleClientSecret, googleRefreshToken); }
  catch (error) { return Response.json({ ok: false, error: errorMessage(error, "Google OAuth token exchange failed") }, { status: 502 }); }
  let sent = 0; let skipped = 0; const failures: string[] = [];
  for (const [staffEmail, items] of byStaff) {
    const { data: existing, error: existingError } = await supabase.from("staff_digest_deliveries")
      .select("id,status").eq("staff_email", staffEmail).eq("delivery_date", deliveryDate).maybeSingle();
    if (existingError) { failures.push(`${staffEmail}: ${existingError.message}`); continue; }
    if (existing) { skipped += 1; continue; }
    const { data: delivery, error: deliveryError } = await supabase.from("staff_digest_deliveries").insert({
      staff_email: staffEmail, delivery_date: deliveryDate, entry_ids: items.map((item) => item.entryId), entry_count: items.length, status: "sending",
    }).select("id").single();
    if (deliveryError) { skipped += 1; continue; }
    let result: Record<string, unknown>;
    try {
      result = await sendGmail(accessToken, sender, staffEmail, `Logbook Surgery CMU: ${items.length} รายการรออนุมัติ`, emailHtml(staff.get(staffEmail) || staffEmail, items, APP_URL));
    } catch (error) {
      const message = errorMessage(error, "Gmail API error");
      failures.push(`${staffEmail}: ${message}`);
      await supabase.from("staff_digest_deliveries").update({ status: "failed", error_message: message.slice(0, 1000) }).eq("id", delivery.id);
      continue;
    }
    await supabase.from("staff_digest_deliveries").update({ status: "sent", provider_message_id: String(result.id || "") || null, sent_at: new Date().toISOString() }).eq("id", delivery.id);
    sent += 1;
  }
  return Response.json({ ok: failures.length === 0, deliveryDate, sent, skipped, failures });
});
