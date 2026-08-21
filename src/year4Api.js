import { supabase } from "./supabase";
import { appUrl } from "./appConfig";

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
  avatarPath: row.avatar_path || "",
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
  selectedApproverId: row.selected_approver_email || "",
  selectedApproverName: profiles.get(row.selected_approver_email)?.name || "",
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
      emailRedirectTo: appUrl,
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
    .select("id,email,full_name,role,student_code,cohort_year,qr_token,avatar_path")
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
  const redirectTo = `${appUrl}/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
  throwIfError(error);
  return "หากอีเมลนี้มีบัญชีอยู่ ระบบจะส่งลิงก์เปลี่ยนรหัสผ่านให้ กรุณารอ 1–2 นาทีแล้วตรวจ Inbox และ Junk mail";
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
    ? supabase.from("profiles").select("id,email,full_name,role,student_code,cohort_year,qr_token,avatar_path").eq("role", "student").eq("active", true).order("student_code")
    : supabase.from("profiles").select("id,email,full_name,role,student_code,cohort_year,qr_token,avatar_path").eq("id", profile.id);
  const [profilesResult, staffResult, staffProfilesResult, entriesResult] = await Promise.all([
    profileQuery,
    supabase.from("user_directory").select("email,full_name").order("full_name"),
    supabase.from("profiles").select("id,email,full_name,role,student_code,cohort_year,qr_token,avatar_path").eq("role", "staff").eq("active", true),
    supabase.from("year4_logbook_entries").select("*").order("activity_date", { ascending: false }).order("updated_at", { ascending: false }),
  ]);
  throwIfError(profilesResult.error);
  throwIfError(staffResult.error);
  throwIfError(staffProfilesResult.error);
  throwIfError(entriesResult.error);
  const students = profilesResult.data.map(mapProfile);
  const staff = staffResult.data.map((row) => ({ id: row.email, email: row.email, name: row.full_name, role: "staff" }));
  const activeStaffProfiles = staffProfilesResult.data.map(mapProfile);
  const profileMap = new Map([
    ...students.map((person) => [person.id, person]),
    ...activeStaffProfiles.map((person) => [person.id, person]),
    ...staff.map((person) => [person.email, person]),
  ]);
  profileMap.set(profile.id, profile);
  return {
    students,
    staff,
    entries: entriesResult.data.map((row) => mapEntry(row, profileMap)),
  };
}

function entryPayload(profile, item, status, staff = []) {
  const selectedStaff = staff.find((person) => person.id === item.selectedApproverId);
  if (!selectedStaff) throw new Error("กรุณาเลือก Staff ผู้อนุมัติจากรายชื่อ");
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
    supervisor_name: selectedStaff.name,
    selected_approver_id: null,
    selected_approver_email: selectedStaff.email,
    detail: item.detail?.trim() || null,
    status,
    submitted_at: null,
    approved_at: null,
    approved_by: null,
    approver_comment: null,
    onedrive_sync_status: "not_required",
  };
}

export async function createYear4Entry(profile, item, status, staff) {
  if (profile.role !== "student") throw new Error("เฉพาะ Student เท่านั้นที่บันทึก Logbook ได้");
  const { data, error } = await supabase.from("year4_logbook_entries").insert(entryPayload(profile, item, status, staff)).select().single();
  throwIfError(error);
  return mapEntry(data, new Map(staff.map((person) => [person.id, person])));
}

export async function updateYear4Entry(profile, item, status, staff) {
  if (profile.role !== "student") throw new Error("เฉพาะ Student เท่านั้นที่แก้ไข Logbook ได้");
  const payload = entryPayload(profile, item, status, staff);
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
  return mapEntry(data, new Map(staff.map((person) => [person.id, person])));
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
      approved_at: null,
      approver_comment: comment.trim() || null,
      onedrive_sync_status: decision === "approved" ? "pending" : "not_required",
    })
    .eq("id", entry.id)
    .eq("status", "submitted")
    .eq("selected_approver_email", profile.email)
    .select()
    .single();
  throwIfError(error);
  return mapEntry(data, new Map([[profile.id, profile]]));
}

export async function getYear4StudentPhotoUrl(avatarPath) {
  if (!avatarPath) return "";
  const { data, error } = await supabase.storage.from("student-avatars").createSignedUrl(avatarPath, 60 * 60);
  throwIfError(error);
  return data.signedUrl;
}

export async function uploadYear4StudentPhoto(profile, file) {
  if (profile.role !== "student") throw new Error("เฉพาะ Student เท่านั้นที่เพิ่มรูปได้");
  if (!file) throw new Error("กรุณาเลือกไฟล์รูปภาพ");
  const allowedTypes = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);
  const extension = allowedTypes.get(file.type);
  if (!extension) throw new Error("รองรับเฉพาะไฟล์ JPG, PNG หรือ WebP");
  if (file.size > 5 * 1024 * 1024) throw new Error("ไฟล์รูปต้องมีขนาดไม่เกิน 5 MB");

  const avatarPath = `${profile.id}/profile.${extension}`;
  const uploadResult = await supabase.storage.from("student-avatars").upload(avatarPath, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: "3600",
  });
  throwIfError(uploadResult.error);
  const profileResult = await supabase.from("profiles").update({ avatar_path: avatarPath }).eq("id", profile.id);
  throwIfError(profileResult.error);
  return { avatarPath, url: await getYear4StudentPhotoUrl(avatarPath) };
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
