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
      return json(request, 403, { error: "เฉพาะ Admin เท่านั้นที่ดำเนินการนี้ได้" });
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "delete_logbook");
    const password = String(body.password || "");
    const scope = String(body.scope || "");
    const studentId = String(body.studentId || "");
    const studentGroup = String(body.studentGroup || "");
    const curriculumId = String(body.curriculumId || "");
    const entryId = String(body.entryId || "");
    const studentIds = Array.isArray(body.studentIds) ? body.studentIds.map(String).filter(Boolean) : [];
    const destinationCurriculumId = String(body.destinationCurriculumId || "");
    const destinationGroup = String(body.destinationGroup || "");
    const destinationRotationId = body.destinationRotationId ? String(body.destinationRotationId) : null;
    const override = Boolean(body.override);
    const reason = String(body.reason || "");
    const promotionId = String(body.promotionId || "");
    if (!password) return json(request, 400, { error: "กรุณากรอกรหัสผ่าน Admin" });
    if (!new Set(["delete_logbook", "delete_avatars", "delete_logbook_entry", "promote_students", "rollback_promotion"]).has(action)) return json(request, 400, { error: "คำสั่งไม่ถูกต้อง" });
    if (action.startsWith("delete_")) {
      if (!new Set(["student", "group", "all"]).has(scope)) return json(request, 400, { error: "ขอบเขตการลบไม่ถูกต้อง" });
      if (action === "delete_avatars" && scope === "all") return json(request, 400, { error: "การลบรูปต้องเลือกนักศึกษารายคนหรือกลุ่ม Student" });
      if (scope === "student" && !studentId) return json(request, 400, { error: "กรุณาเลือกนักศึกษา" });
      if (scope === "group" && !studentGroup) return json(request, 400, { error: "กรุณาเลือกกลุ่มนักศึกษา" });
      if (action === "delete_logbook_entry" && !entryId) return json(request, 400, { error: "กรุณาเลือกรายการหัตถการ" });
    }
    if (action === "promote_students" && (!studentIds.length || !destinationCurriculumId || !destinationGroup)) return json(request, 400, { error: "กรุณาเลือกนักศึกษา Curriculum และกลุ่มปลายทาง" });
    if (action === "promote_students" && override && !reason.trim()) return json(request, 400, { error: "กรุณาระบุเหตุผลที่ override" });
    if (action === "rollback_promotion" && (!promotionId || !reason.trim())) return json(request, 400, { error: "กรุณาเลือก promotion และระบุเหตุผล rollback" });

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
    if (action === "promote_students") {
      const { data, error } = await adminClient.rpc("admin_promote_students", {
        p_actor_id: caller.id,
        p_student_ids: studentIds,
        p_destination_curriculum_id: destinationCurriculumId,
        p_group_code: destinationGroup,
        p_rotation_id: destinationRotationId,
        p_override: override,
        p_reason: reason.trim() || null,
      });
      if (error) throw error;
      return json(request, 200, data || { ok: true, promotedCount: studentIds.length });
    }
    if (action === "rollback_promotion") {
      const { data, error } = await adminClient.rpc("admin_rollback_promotion", {
        p_actor_id: caller.id,
        p_promotion_id: promotionId,
        p_reason: reason.trim(),
      });
      if (error) throw error;
      return json(request, 200, data || { ok: true });
    }
    let targetStudentIds: string[] = [];
    let targetEnrollmentIds: string[] = [];
    let avatarPaths: string[] = [];
    if (scope === "student") {
      const { data: student, error } = await adminClient
        .from("profiles")
        .select("id,avatar_path")
        .eq("id", studentId)
        .eq("role", "student")
        .eq("active", true)
        .maybeSingle();
      if (error) throw error;
      if (!student) return json(request, 404, { error: "ไม่พบนักศึกษาที่เลือก" });
      targetStudentIds = [student.id];
      avatarPaths = student.avatar_path ? [student.avatar_path] : [];
    } else if (scope === "group") {
      let enrollmentQuery = adminClient.from("student_enrollments").select("id,student_id").eq("group_code", studentGroup);
      if (curriculumId) enrollmentQuery = enrollmentQuery.eq("curriculum_id", curriculumId);
      else if (action === "delete_avatars") enrollmentQuery = enrollmentQuery.eq("status", "active");
      const { data: groupEnrollments, error: enrollmentError } = await enrollmentQuery;
      if (enrollmentError) throw enrollmentError;
      targetEnrollmentIds = (groupEnrollments || []).map((item) => item.id);
      targetStudentIds = [...new Set((groupEnrollments || []).map((item) => item.student_id))];
      if (!targetStudentIds.length) return json(request, 404, { error: "ไม่พบนักศึกษาในกลุ่มที่เลือก" });
      const { data: students, error } = await adminClient.from("profiles").select("id,avatar_path").in("id", targetStudentIds);
      if (error) throw error;
      avatarPaths = (students || []).map((student) => student.avatar_path).filter(Boolean);
    }

    if (action === "delete_logbook" && curriculumId && scope !== "group") {
      let enrollmentQuery = adminClient.from("student_enrollments").select("id").eq("curriculum_id", curriculumId);
      if (scope === "student") enrollmentQuery = enrollmentQuery.eq("student_id", studentId);
      const { data: scopedEnrollments, error: enrollmentError } = await enrollmentQuery;
      if (enrollmentError) throw enrollmentError;
      targetEnrollmentIds = (scopedEnrollments || []).map((item) => item.id);
      if (!targetEnrollmentIds.length) return json(request, 404, { error: "ไม่พบ Enrollment ใน Curriculum ที่เลือก" });
    }

    if (action === "delete_avatars") {
      let removedCount = 0;
      if (avatarPaths.length) {
        const { data: removed, error: storageError } = await adminClient.storage.from("student-avatars").remove(avatarPaths);
        if (storageError) throw storageError;
        removedCount = removed?.length || 0;

        const { error: profileUpdateError } = await adminClient
          .from("profiles")
          .update({ avatar_path: null })
          .in("id", targetStudentIds);
        if (profileUpdateError) throw profileUpdateError;
      }
      return json(request, 200, {
        ok: true,
        deletedCount: removedCount,
        clearedCount: avatarPaths.length,
        scope,
        studentCount: targetStudentIds.length,
      });
    }

    if (action === "delete_logbook_entry") {
      const { data: deleted, error: deleteError } = await adminClient
        .from("year4_logbook_entries")
        .delete()
        .eq("id", entryId)
        .eq("student_id", studentId)
        .select("id");
      if (deleteError) throw deleteError;
      if (!deleted?.length) return json(request, 404, { error: "ไม่พบหัตถการของนักศึกษาที่เลือก" });
      return json(request, 200, { ok: true, deletedCount: deleted.length, scope, studentCount: 1 });
    }

    let deleteQuery = adminClient.from("year4_logbook_entries").delete().select("id");
    if (targetEnrollmentIds.length) deleteQuery = deleteQuery.in("enrollment_id", targetEnrollmentIds);
    else if (scope === "student" || scope === "group") deleteQuery = deleteQuery.in("student_id", targetStudentIds);
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
