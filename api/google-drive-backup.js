import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import { OAuth2Client } from "google-auth-library";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const FOLDER_MIME = "application/vnd.google-apps.folder";

function send(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").send(JSON.stringify(payload));
}

function bangkokTimestamp() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date()).reduce((value, part) => ({ ...value, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}_${parts.hour}${parts.minute}${parts.second}`;
}

function styleHeader(sheet) {
  const row = sheet.getRow(1);
  row.height = 28;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF155426" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: "A1", to: `${sheet.getColumn(sheet.columnCount).letter}1` };
}

async function makeWorkbook(entries, students, activities, events) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Surgery CMU Year 4 Logbook";
  workbook.created = new Date();
  const studentMap = new Map(students.map((student) => [student.id, student]));
  const activityMap = new Map(activities.map((activity) => [activity.id, activity]));

  const studentsSheet = workbook.addWorksheet("Students");
  studentsSheet.columns = [
    ["student_code", "รหัสนักศึกษา", 17], ["student_group", "กลุ่มที่", 11], ["full_name", "ชื่อ-นามสกุล", 30],
    ["email", "อีเมล", 34], ["cohort_year", "ปีการศึกษา", 14],
  ].map(([key, header, width]) => ({ key, header, width }));
  students.forEach((student) => studentsSheet.addRow(student));
  styleHeader(studentsSheet);

  const logbook = workbook.addWorksheet("Logbook");
  logbook.columns = [
    ["activity_date", "วันที่", 14], ["student_code", "รหัสนักศึกษา", 16], ["student_group", "กลุ่มที่", 11],
    ["student_name", "ชื่อนักศึกษา", 28], ["category", "หมวดกิจกรรม", 22], ["activity", "กิจกรรม", 38],
    ["week", "สัปดาห์", 10], ["unit", "หน่วย/Ward", 22], ["case", "รหัสเคสแบบปกปิด", 20],
    ["diagnosis", "Diagnosis/ประสบการณ์", 32], ["procedure", "Procedure/หัวข้อ", 32], ["detail", "รายละเอียด", 36],
    ["supervisor", "Staff ผู้อนุมัติ", 28], ["status", "สถานะ", 14], ["submitted_at", "นักศึกษาบันทึก", 22],
    ["approved_at", "Staff อนุมัติ", 22], ["comment", "ความคิดเห็น", 34], ["revision", "Revision", 10],
  ].map(([key, header, width]) => ({ key, header, width }));
  entries.forEach((entry) => {
    const student = studentMap.get(entry.student_id) || {};
    const activity = activityMap.get(entry.activity_type) || {};
    logbook.addRow({
      activity_date: entry.activity_date,
      student_code: student.student_code || "",
      student_group: student.student_group || "",
      student_name: student.full_name || entry.student_id,
      category: activity.group_name || "",
      activity: activity.title_th || entry.activity_type,
      week: entry.week_number || "",
      unit: entry.unit_name || "",
      case: entry.patient_reference || "",
      diagnosis: entry.diagnosis || "",
      procedure: entry.procedure_name || entry.activity_title || "",
      detail: entry.detail || "",
      supervisor: entry.supervisor_name || entry.selected_approver_email || "",
      status: entry.status,
      submitted_at: entry.submitted_at || "",
      approved_at: entry.approved_at || "",
      comment: entry.approver_comment || "",
      revision: entry.revision,
    });
  });
  styleHeader(logbook);

  const audit = workbook.addWorksheet("Approval Audit");
  audit.columns = [
    { key: "created_at", header: "เวลา", width: 24 }, { key: "entry_id", header: "Entry ID", width: 38 },
    { key: "student_id", header: "Student ID", width: 38 }, { key: "actor_id", header: "Actor ID", width: 38 },
    { key: "from_status", header: "จากสถานะ", width: 16 }, { key: "to_status", header: "เป็นสถานะ", width: 16 },
    { key: "comment", header: "ความคิดเห็น", width: 40 }, { key: "revision", header: "Revision", width: 10 },
  ];
  events.forEach((event) => audit.addRow(event));
  styleHeader(audit);

  const manifest = workbook.addWorksheet("Manifest");
  manifest.addRows([
    ["รายการ", "ค่า"],
    ["Generated at", new Date().toISOString()],
    ["Timezone", "Asia/Bangkok"],
    ["Backup destination", process.env.GOOGLE_DRIVE_ACCOUNT_EMAIL || "edusurgcmu@gmail.com"],
    ["Students", students.length],
    ["Logbook entries", entries.length],
    ["Approval events", events.length],
    ["Source", "Supabase PostgreSQL with Row Level Security"],
  ]);
  manifest.getColumn(1).width = 26;
  manifest.getColumn(2).width = 58;
  styleHeader(manifest);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function driveRequest(token, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || `Google Drive API error ${response.status}`);
  return payload;
}

async function createFolder(token, name, parentId) {
  return driveRequest(token, "https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink&supportsAllDrives=true", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parentId ? { parents: [parentId] } : {}) }),
  });
}

async function getBackupRoot(token) {
  if (process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID) return { id: process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID };
  const name = process.env.GOOGLE_DRIVE_BACKUP_ROOT_NAME || "Surgery CMU Year4 Logbook Backups";
  const escapedName = name.replaceAll("'", "\\'");
  const query = encodeURIComponent(`name = '${escapedName}' and mimeType = '${FOLDER_MIME}' and trashed = false`);
  const result = await driveRequest(token, `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name,webViewLink)&pageSize=1`);
  return result.files?.[0] || createFolder(token, name);
}

async function uploadWorkbook(token, folderId, name, buffer) {
  const boundary = `surgery_year4_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const metadata = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, mimeType: XLSX_MIME, parents: [folderId] })}\r\n--${boundary}\r\nContent-Type: ${XLSX_MIME}\r\n\r\n`);
  const ending = Buffer.from(`\r\n--${boundary}--`);
  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink&supportsAllDrives=true", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body: Buffer.concat([metadata, buffer, ending]),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || `Google Drive upload error ${response.status}`);
  return payload;
}

async function googleAccessToken() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) throw new Error("ยังไม่ได้เชื่อม Google Drive OAuth บน Vercel");
  const oauth = new OAuth2Client(clientId, clientSecret);
  oauth.setCredentials({ refresh_token: refreshToken });
  const result = await oauth.getAccessToken();
  if (!result.token) throw new Error("Google OAuth ไม่ออก access token");
  return result.token;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  try {
    const accessToken = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!accessToken) return send(res, 401, { error: "กรุณาเข้าสู่ระบบก่อนสำรองข้อมูล" });

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !supabaseKey) throw new Error("ยังไม่ได้ตั้งค่า Supabase environment บน Vercel");
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userData.user) return send(res, 401, { error: "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่" });
    const { data: caller, error: callerError } = await supabase.from("profiles").select("role,active").eq("id", userData.user.id).single();
    if (callerError || caller?.role !== "admin" || !caller.active) return send(res, 403, { error: "เฉพาะ Admin เท่านั้นที่สำรองข้อมูลทั้งหมดได้" });

    const [studentResult, entryResult, activityResult, eventResult] = await Promise.all([
      supabase.from("profiles").select("id,student_code,student_group,full_name,email,cohort_year").eq("role", "student").eq("active", true).order("student_code"),
      supabase.from("year4_logbook_entries").select("*").order("activity_date", { ascending: false }),
      supabase.from("year4_activity_definitions").select("id,title_th,group_name").order("sort_order"),
      supabase.from("year4_approval_events").select("*").order("created_at", { ascending: false }),
    ]);
    const queryError = [studentResult.error, entryResult.error, activityResult.error, eventResult.error].find(Boolean);
    if (queryError) throw queryError;

    const timestamp = bangkokTimestamp();
    const fileName = `Year4_Logbook_Backup_${timestamp}.xlsx`;
    const buffer = await makeWorkbook(entryResult.data, studentResult.data, activityResult.data, eventResult.data);
    const token = await googleAccessToken();
    const root = await getBackupRoot(token);
    const batchFolder = await createFolder(token, timestamp, root.id);
    const uploaded = await uploadWorkbook(token, batchFolder.id, fileName, buffer);

    return send(res, 200, {
      ok: true,
      fileName,
      fileId: uploaded.id,
      fileUrl: uploaded.webViewLink || "",
      folderUrl: batchFolder.webViewLink || `https://drive.google.com/drive/folders/${batchFolder.id}`,
      timestamp,
    });
  } catch (error) {
    console.error("Google Drive backup failed", error);
    return send(res, 500, { error: `สำรองข้อมูลไม่สำเร็จ: ${error.message}` });
  }
}
