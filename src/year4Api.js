import { supabase } from "./supabase";

function throwIfError(error) {
  if (error) throw error;
}

const mapProfile = (row) => ({
  id: row.id,
  name: row.full_name,
  email: row.email,
  role: row.role,
  studentCode: row.student_code || "",
  cohortYear: row.cohort_year || null,
  qrToken: row.qr_token || "",
});

const mapEntry = (row, profiles = new Map()) => ({
  id: row.id,
  studentId: row.student_id,
  activityType: row.activity_type,
  date: row.activity_date,
  weekNumber: row.week_number,
  unitName: row.unit_name || "",
  patientReference: row.patient_reference || "",
  diagnosis: row.diagnosis || "",
  procedureName: row.procedure_name || "",
  participation: row.participation || "",
  activityTitle: row.activity_title || "",
  supervisorName: row.supervisor_name || "",
  detail: row.detail || "",
  status: row.status,
  submittedAt: row.submitted_at,
  approvedAt: row.approved_at,
  approvedBy: row.approved_by,
  approverName: profiles.get(row.approved_by)?.name || "",
  approverComment: row.approver_comment || "",
  revision: row.revision,
  oneDriveSyncStatus: row.onedrive_sync_status,
  oneDriveSyncedAt: row.onedrive_synced_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function signInYear4({ email, password, role }) {
  const normalizedEmail = email.trim().toLowerCase();
  const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
  throwIfError(error);
  const profile = await getCurrentYear4Profile();
  if (!profile || profile.role !== role) {
    await supabase.auth.signOut();
    throw new Error("บทบาทผู้ใช้งานไม่ตรงกับบัญชีที่ได้รับอนุญาต");
  }
  return profile;
}

export async function activateYear4Account({ email, password, role, fullName = "", studentCode = "" }) {
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      emailRedirectTo: window.location.origin,
      data: {
        requested_role: role,
        full_name: fullName.trim(),
        student_code: studentCode.trim(),
        cohort_year: 2568,
      },
    },
  });
  if (error?.message === "Database error saving new user" || error?.code === "unexpected_failure") {
    throw new Error(role === "staff"
      ? "อีเมล Staff ไม่อยู่ในรายชื่อที่ได้รับอนุญาต กรุณาติดต่อผู้ดูแลระบบ"
      : "ไม่สามารถสร้างบัญชี Student ได้ กรุณาตรวจชื่อ รหัสนักศึกษา และอีเมลอีกครั้ง");
  }
  throwIfError(error);
  if (data.user?.identities?.length === 0) {
    return { profile: null, message: "อีเมลนี้มีบัญชีแล้ว กรุณาเข้าสู่ระบบหรือใช้เมนูลืมรหัสผ่าน" };
  }
  if (!data.session) {
    return { profile: null, message: "สร้างบัญชีแล้ว กรุณากดลิงก์ยืนยันที่ส่งไปทางอีเมลก่อนเข้าสู่ระบบ" };
  }
  const profile = await getCurrentYear4Profile();
  if (profile?.role !== role) {
    await supabase.auth.signOut();
    throw new Error("บทบาทผู้ใช้งานไม่ตรงกับรายชื่อที่ได้รับอนุญาต");
  }
  return { profile, message: "เปิดใช้งานบัญชีสำเร็จ" };
}

export async function getCurrentYear4Profile() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,student_code,cohort_year,qr_token")
    .eq("id", userData.user.id)
    .single();
  throwIfError(error);
  return mapProfile(data);
}

export async function signOutYear4() {
  const { error } = await supabase.auth.signOut();
  throwIfError(error);
}

export async function requestYear4PasswordReset(email) {
  const redirectTo = `${window.location.origin}/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
  throwIfError(error);
  return "ส่งลิงก์เปลี่ยนรหัสผ่านแล้ว กรุณาตรวจ Inbox และ Junk mail";
}

export async function updateYear4Password(password) {
  const { data, error } = await supabase.auth.getSession();
  throwIfError(error);
  if (!data.session) throw new Error("ลิงก์ไม่ถูกต้องหรือหมดอายุ กรุณาขอลิงก์ใหม่");
  const result = await supabase.auth.updateUser({ password });
  throwIfError(result.error);
}

export function subscribeToYear4Auth(callback) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => callback(event, session));
  return () => data.subscription.unsubscribe();
}

export async function loadYear4Record(profile) {
  const profileQuery = profile.role === "staff"
    ? supabase.from("profiles").select("id,email,full_name,role,student_code,cohort_year,qr_token").eq("role", "student").eq("active", true).order("student_code")
    : supabase.from("profiles").select("id,email,full_name,role,student_code,cohort_year,qr_token").eq("id", profile.id);
  const [profilesResult, entriesResult] = await Promise.all([
    profileQuery,
    supabase.from("year4_logbook_entries").select("*").order("activity_date", { ascending: false }).order("updated_at", { ascending: false }),
  ]);
  throwIfError(profilesResult.error);
  throwIfError(entriesResult.error);
  const students = profilesResult.data.map(mapProfile);
  const profileMap = new Map(students.map((student) => [student.id, student]));
  profileMap.set(profile.id, profile);
  return {
    students,
    entries: entriesResult.data.map((row) => mapEntry(row, profileMap)),
  };
}

function entryPayload(profile, item, status) {
  return {
    student_id: profile.id,
    recorded_by: profile.id,
    activity_type: item.activityType,
    activity_date: item.date,
    week_number: item.weekNumber || null,
    unit_name: item.unitName?.trim() || null,
    patient_reference: item.patientReference?.trim() || null,
    diagnosis: item.diagnosis?.trim() || null,
    procedure_name: item.procedureName?.trim() || null,
    participation: item.participation || null,
    activity_title: item.activityTitle?.trim() || null,
    supervisor_name: item.supervisorName?.trim() || null,
    detail: item.detail?.trim() || null,
    status,
    submitted_at: status === "submitted" ? new Date().toISOString() : null,
    approved_at: null,
    approved_by: null,
    approver_comment: null,
    onedrive_sync_status: "not_required",
  };
}

export async function createYear4Entry(profile, item, status) {
  if (profile.role !== "student") throw new Error("เฉพาะ Student เท่านั้นที่บันทึก Logbook ได้");
  const { data, error } = await supabase.from("year4_logbook_entries").insert(entryPayload(profile, item, status)).select().single();
  throwIfError(error);
  return mapEntry(data);
}

export async function updateYear4Entry(profile, item, status) {
  if (profile.role !== "student") throw new Error("เฉพาะ Student เท่านั้นที่แก้ไข Logbook ได้");
  const payload = entryPayload(profile, item, status);
  payload.revision = (item.revision || 1) + (item.status === "rejected" && status === "submitted" ? 1 : 0);
  const { data, error } = await supabase
    .from("year4_logbook_entries")
    .update(payload)
    .eq("id", item.id)
    .eq("student_id", profile.id)
    .in("status", ["draft", "rejected"])
    .select()
    .single();
  throwIfError(error);
  return mapEntry(data);
}

export async function reviewYear4Entry(profile, entry, decision, comment) {
  if (profile.role !== "staff") throw new Error("เฉพาะ Staff เท่านั้นที่อนุมัติรายการได้");
  if (!['approved', 'rejected'].includes(decision)) throw new Error("สถานะการประเมินไม่ถูกต้อง");
  if (decision === "rejected" && !comment.trim()) throw new Error("กรุณาระบุเหตุผลที่ส่งกลับแก้ไข");
  const { data, error } = await supabase
    .from("year4_logbook_entries")
    .update({
      status: decision,
      approved_by: decision === "approved" ? profile.id : null,
      approved_at: decision === "approved" ? new Date().toISOString() : null,
      approver_comment: comment.trim() || null,
      onedrive_sync_status: decision === "approved" ? "pending" : "not_required",
    })
    .eq("id", entry.id)
    .eq("status", "submitted")
    .select()
    .single();
  throwIfError(error);
  return mapEntry(data, new Map([[profile.id, profile]]));
}

export async function backupYear4ToOneDrive() {
  const { data, error } = await supabase.auth.getSession();
  throwIfError(error);
  if (!data.session?.access_token) throw new Error("กรุณาเข้าสู่ระบบใหม่ก่อนสำรองข้อมูล");
  const response = await fetch("/api/onedrive-backup", {
    method: "POST",
    headers: { Authorization: `Bearer ${data.session.access_token}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "ไม่สามารถสำรองข้อมูลไป OneDrive ได้");
  return payload;
}
