import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const allowedOrigins = new Set([
  "https://logbook-surgery-website.vercel.app",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
]);

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://logbook-surgery-website.vercel.app",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(request: Request, status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json; charset=utf-8" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, 405, { error: "Method not allowed" });

  const origin = request.headers.get("origin") || "";
  if (origin && !allowedOrigins.has(origin)) return json(request, 403, { error: "Origin not allowed" });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const authorization = request.headers.get("Authorization") || "";
    if (!supabaseUrl || !publishableKey || !serviceRoleKey || !authorization.startsWith("Bearer ")) {
      return json(request, 401, { error: "กรุณาเข้าสู่ระบบใหม่" });
    }

    const callerClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user?.email) return json(request, 401, { error: "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่" });

    const { data: caller, error: profileError } = await callerClient
      .from("profiles")
      .select("id,email,role,active")
      .eq("id", userData.user.id)
      .single();
    if (profileError || caller?.role !== "admin" || !caller.active) {
      return json(request, 403, { error: "เฉพาะ Admin เท่านั้นที่ลบข้อมูลได้" });
    }

    const body = await request.json().catch(() => ({}));
    const password = String(body.password || "");
    const scope = String(body.scope || "");
    const studentId = String(body.studentId || "");
    const studentGroup = String(body.studentGroup || "");
    if (!password) return json(request, 400, { error: "กรุณากรอกรหัสผ่าน Admin" });
    if (!new Set(["student", "group", "all"]).has(scope)) return json(request, 400, { error: "ขอบเขตการลบไม่ถูกต้อง" });
    if (scope === "student" && !studentId) return json(request, 400, { error: "กรุณาเลือกนักศึกษา" });
    if (scope === "group" && !studentGroup) return json(request, 400, { error: "กรุณาเลือกกลุ่มนักศึกษา" });

    const passwordClient = createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: passwordError } = await passwordClient.auth.signInWithPassword({
      email: caller.email,
      password,
    });
    if (passwordError) return json(request, 401, { error: "รหัสผ่าน Admin ไม่ถูกต้อง" });
    // Clear only this temporary in-memory session. A global sign-out would
    // revoke the Admin's active browser refresh token as well.
    await passwordClient.auth.signOut({ scope: "local" }).catch(() => {});

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let targetStudentIds: string[] = [];
    if (scope === "student") {
      const { data: student, error } = await adminClient
        .from("profiles")
        .select("id")
        .eq("id", studentId)
        .eq("role", "student")
        .eq("active", true)
        .maybeSingle();
      if (error) throw error;
      if (!student) return json(request, 404, { error: "ไม่พบนักศึกษาที่เลือก" });
      targetStudentIds = [student.id];
    } else if (scope === "group") {
      const { data: students, error } = await adminClient
        .from("profiles")
        .select("id")
        .eq("role", "student")
        .eq("active", true)
        .eq("student_group", studentGroup);
      if (error) throw error;
      targetStudentIds = (students || []).map((student) => student.id);
      if (!targetStudentIds.length) return json(request, 404, { error: "ไม่พบนักศึกษาในกลุ่มที่เลือก" });
    }

    let deleteQuery = adminClient.from("year4_logbook_entries").delete().select("id");
    if (scope === "student" || scope === "group") deleteQuery = deleteQuery.in("student_id", targetStudentIds);
    else deleteQuery = deleteQuery.not("id", "is", null);
    const { data: deleted, error: deleteError } = await deleteQuery;
    if (deleteError) throw deleteError;

    return json(request, 200, {
      ok: true,
      deletedCount: deleted?.length || 0,
      scope,
      studentCount: scope === "all" ? null : targetStudentIds.length,
    });
  } catch (error) {
    console.error("Admin data operation failed", error);
    return json(request, 500, { error: `ดำเนินการไม่สำเร็จ: ${error instanceof Error ? error.message : "Unknown error"}` });
  }
});
