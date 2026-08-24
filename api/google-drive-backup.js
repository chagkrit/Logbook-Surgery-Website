import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import { OAuth2Client } from "google-auth-library";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PDF_MIME = "application/pdf";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";

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

function detectBackupAnomalies(entries, students, activities, rotations) {
  const today = new Date().toISOString().slice(0, 10);
  const studentMap = new Map(students.map((student) => [student.id, student]));
  const activityMap = new Map(activities.map((activity) => [activity.id, activity]));
  const seen = new Set();
  const anomalies = [];
  entries.forEach((entry) => {
    const student = studentMap.get(entry.student_id) || {};
    const activity = activityMap.get(entry.activity_type) || {};
    const key = [entry.student_id, entry.activity_type, entry.activity_date, entry.patient_reference || entry.week_number || entry.unit_name || ""].join("|");
    const add = (type, severity, message) => anomalies.push({ type, severity, entry_id: entry.id, student_code: student.student_code || "", student_name: student.full_name || entry.student_id, activity: activity.title_th || entry.activity_type, activity_date: entry.activity_date, message });
    if (seen.has(key)) add("duplicate", "warning", "อาจเป็นรายการซ้ำในวันและกิจกรรมเดียวกัน"); else seen.add(key);
    if (entry.activity_date > today) add("future-date", "danger", "วันที่ทำกิจกรรมอยู่ในอนาคต");
    if (entry.approved_at && entry.submitted_at && new Date(entry.approved_at) < new Date(entry.submitted_at)) add("timestamp", "danger", "เวลาอนุมัติก่อนเวลาที่นักศึกษาส่ง");
    if (["patient-care", "major-operation-observe", "major-operation-assist", "minor-operation", "wound-suture", "foley-catheter", "venipuncture", "stomal-care", "nasogastric-tube", "major-trauma-first-aid", "proctoscopy"].includes(entry.activity_type) && !entry.patient_reference) add("missing", "warning", "ขาดรหัสเคสแบบปกปิด");
    const rotation = rotations.find((item) => item.academic_year === (entry.academic_year || student.cohort_year) && item.group_code === student.student_group);
    if (rotation && (entry.activity_date < rotation.start_date || entry.activity_date > rotation.end_date)) add("outside-rotation", "warning", "วันที่กิจกรรมอยู่นอกช่วง rotation");
  });
  return anomalies;
}

async function makeWorkbook(entries, students, activities, events, rotations, certifications) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Surgery CMU Year 4 Logbook";
  workbook.created = new Date();
  const studentMap = new Map(students.map((student) => [student.id, student]));
  const activityMap = new Map(activities.map((activity) => [activity.id, activity]));
  const anomalies = detectBackupAnomalies(entries, students, activities, rotations);
  const totalTarget = activities.reduce((sum, activity) => sum + (activity.target_count || 0), 0);

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

  const rotationsSheet = workbook.addWorksheet("Rotations");
  rotationsSheet.columns = [
    { key: "academic_year", header: "ปีการศึกษา", width: 14 }, { key: "group_code", header: "กลุ่ม", width: 10 },
    { key: "name", header: "ชื่อ Rotation", width: 30 }, { key: "start_date", header: "วันเริ่ม", width: 14 },
    { key: "end_date", header: "วันสิ้นสุด", width: 14 }, { key: "status", header: "สถานะ", width: 14 },
  ];
  rotations.forEach((rotation) => rotationsSheet.addRow(rotation));
  styleHeader(rotationsSheet);

  const certificationsSheet = workbook.addWorksheet("Certifications");
  certificationsSheet.columns = [
    { key: "student_id", header: "Student ID", width: 38 }, { key: "academic_year", header: "ปีการศึกษา", width: 14 },
    { key: "selected_certifier_email", header: "Staff ผู้รับรอง", width: 34 }, { key: "status", header: "สถานะ", width: 16 },
    { key: "submitted_at", header: "ส่งรับรองเมื่อ", width: 24 }, { key: "certified_at", header: "รับรองเมื่อ", width: 24 },
    { key: "certifier_note", header: "หมายเหตุ", width: 40 },
  ];
  certifications.forEach((item) => certificationsSheet.addRow(item));
  styleHeader(certificationsSheet);

  const quality = workbook.addWorksheet("Program Quality");
  quality.columns = [
    { key: "student_code", header: "รหัสนักศึกษา", width: 17 }, { key: "student_group", header: "กลุ่ม", width: 10 },
    { key: "student_name", header: "นักศึกษา", width: 30 }, { key: "approved", header: "อนุมัติแล้ว", width: 14 },
    { key: "completed", header: "ครบตามเป้า", width: 14 }, { key: "required", header: "เป้าหมายรวม", width: 14 },
    { key: "progress", header: "ความก้าวหน้า (%)", width: 18 }, { key: "pending", header: "รออนุมัติ", width: 14 },
    { key: "stale", header: "ค้างเกิน 48 ชม.", width: 18 }, { key: "rejected", header: "ส่งกลับ", width: 14 },
    { key: "anomalies", header: "ข้อมูลผิดปกติ", width: 16 },
  ];
  students.forEach((student) => {
    const rows = entries.filter((entry) => entry.student_id === student.id);
    const approvedByActivity = new Map();
    rows.filter((entry) => entry.status === "approved").forEach((entry) => approvedByActivity.set(entry.activity_type, (approvedByActivity.get(entry.activity_type) || 0) + 1));
    const completed = activities.reduce((sum, activity) => sum + Math.min(activity.target_count || 0, approvedByActivity.get(activity.id) || 0), 0);
    const stale = rows.filter((entry) => entry.status === "submitted" && entry.submitted_at && Date.now() - new Date(entry.submitted_at).getTime() > 48 * 60 * 60 * 1000).length;
    quality.addRow({ student_code: student.student_code, student_group: student.student_group, student_name: student.full_name, approved: rows.filter((entry) => entry.status === "approved").length, completed, required: totalTarget, progress: totalTarget ? Math.round(completed / totalTarget * 100) : 0, pending: rows.filter((entry) => entry.status === "submitted").length, stale, rejected: rows.filter((entry) => entry.status === "rejected").length, anomalies: anomalies.filter((item) => item.student_code === student.student_code).length });
  });
  styleHeader(quality);

  const anomalySheet = workbook.addWorksheet("Data Anomalies");
  anomalySheet.columns = [
    { key: "severity", header: "ระดับ", width: 12 }, { key: "type", header: "ประเภท", width: 18 },
    { key: "student_code", header: "รหัสนักศึกษา", width: 17 }, { key: "student_name", header: "นักศึกษา", width: 28 },
    { key: "activity_date", header: "วันที่", width: 14 }, { key: "activity", header: "กิจกรรม", width: 38 },
    { key: "message", header: "รายละเอียด", width: 44 }, { key: "entry_id", header: "Entry ID", width: 38 },
  ];
  anomalies.forEach((item) => anomalySheet.addRow(item));
  styleHeader(anomalySheet);

  const manifest = workbook.addWorksheet("Manifest");
  manifest.addRows([
    ["รายการ", "ค่า"],
    ["Generated at", new Date().toISOString()],
    ["Timezone", "Asia/Bangkok"],
    ["Backup destination", process.env.GOOGLE_DRIVE_ACCOUNT_EMAIL || "edusurgcmu@gmail.com"],
    ["Students", students.length],
    ["Logbook entries", entries.length],
    ["Approval events", events.length],
    ["Rotations", rotations.length],
    ["Certifications", certifications.length],
    ["Data anomalies", anomalies.length],
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

async function uploadBuffer(token, folderId, name, buffer, mimeType, metadataMimeType = mimeType) {
  const boundary = `surgery_year4_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const metadata = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, mimeType: metadataMimeType, parents: [folderId] })}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`);
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

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}

function makePdfHtml(entries, students, activities, rotations, timestamp) {
  const studentMap = new Map(students.map((student) => [student.id, student]));
  const activityMap = new Map(activities.map((activity) => [activity.id, activity]));
  const rows = entries.map((entry) => { const student = studentMap.get(entry.student_id) || {}; const activity = activityMap.get(entry.activity_type) || {}; return `<tr><td>${escapeHtml(entry.activity_date)}</td><td>${escapeHtml(student.student_code)}</td><td>${escapeHtml(student.full_name)}</td><td>${escapeHtml(activity.group_name)}</td><td>${escapeHtml(activity.title_th || entry.activity_type)}</td><td>${escapeHtml(entry.status)}</td><td>${escapeHtml(entry.submitted_at)}</td><td>${escapeHtml(entry.approved_at)}</td></tr>`; }).join("");
  const anomalyCount = detectBackupAnomalies(entries, students, activities, rotations).length;
  return Buffer.from(`<!doctype html><html lang="th"><head><meta charset="utf-8"><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial,"Noto Sans Thai",sans-serif;font-size:9px;color:#202124}h1{color:#155426;margin-bottom:4px}p{color:#59636d}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccd3d8;padding:5px;vertical-align:top}th{background:#155426;color:#fff}</style></head><body><h1>Surgery CMU Year 4 Logbook</h1><p>สำรองข้อมูลเมื่อ ${escapeHtml(timestamp)} เวลา Asia/Bangkok · นักศึกษา ${students.length} คน · Logbook ${entries.length} รายการ · จุดข้อมูลผิดปกติ ${anomalyCount}</p><table><thead><tr><th>วันที่</th><th>รหัส</th><th>นักศึกษา</th><th>หมวด</th><th>กิจกรรม</th><th>สถานะ</th><th>นักศึกษาบันทึก</th><th>Staff อนุมัติ</th></tr></thead><tbody>${rows || '<tr><td colspan="8">ยังไม่มีข้อมูล</td></tr>'}</tbody></table></body></html>`, "utf8");
}

async function createPdfViaGoogleDrive(token, folderId, name, htmlBuffer) {
  const temporary = await uploadBuffer(token, folderId, `${name}.source`, htmlBuffer, "text/html; charset=UTF-8", GOOGLE_DOC_MIME);
  try {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${temporary.id}/export?mimeType=${encodeURIComponent(PDF_MIME)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) { const payload = await response.json().catch(() => ({})); throw new Error(payload.error?.message || `Google Drive PDF export error ${response.status}`); }
    return Buffer.from(await response.arrayBuffer());
  } finally {
    await driveRequest(token, `https://www.googleapis.com/drive/v3/files/${temporary.id}`, { method: "DELETE" }).catch(() => {});
  }
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

    const [studentResult, entryResult, activityResult, eventResult, rotationResult, certificationResult] = await Promise.all([
      supabase.from("profiles").select("id,student_code,student_group,full_name,email,cohort_year").eq("role", "student").eq("active", true).order("student_code"),
      supabase.from("year4_logbook_entries").select("*").order("activity_date", { ascending: false }),
      supabase.from("year4_activity_definitions").select("id,title_th,group_name,target_count").order("sort_order"),
      supabase.from("year4_approval_events").select("*").order("created_at", { ascending: false }),
      supabase.from("year4_rotations").select("*").order("academic_year", { ascending: false }).order("group_code"),
      supabase.from("year4_logbook_certifications").select("*").order("submitted_at", { ascending: false }),
    ]);
    const queryError = [studentResult.error, entryResult.error, activityResult.error, eventResult.error, rotationResult.error, certificationResult.error].find(Boolean);
    if (queryError) throw queryError;

    const timestamp = bangkokTimestamp();
    const excelFileName = `Year4_Logbook_Backup_${timestamp}.xlsx`;
    const pdfFileName = `Year4_Logbook_Backup_${timestamp}.pdf`;
    const buffer = await makeWorkbook(entryResult.data, studentResult.data, activityResult.data, eventResult.data, rotationResult.data, certificationResult.data);
    const token = await googleAccessToken();
    const root = await getBackupRoot(token);
    const batchFolder = await createFolder(token, timestamp, root.id);
    const uploadedExcel = await uploadBuffer(token, batchFolder.id, excelFileName, buffer, XLSX_MIME);
    const pdfBuffer = await createPdfViaGoogleDrive(token, batchFolder.id, pdfFileName, makePdfHtml(entryResult.data, studentResult.data, activityResult.data, rotationResult.data, timestamp));
    const uploadedPdf = await uploadBuffer(token, batchFolder.id, pdfFileName, pdfBuffer, PDF_MIME);

    return send(res, 200, {
      ok: true,
      fileName: excelFileName,
      fileNames: [excelFileName, pdfFileName],
      files: [{ id: uploadedExcel.id, name: excelFileName, url: uploadedExcel.webViewLink || "" }, { id: uploadedPdf.id, name: pdfFileName, url: uploadedPdf.webViewLink || "" }],
      folderUrl: batchFolder.webViewLink || `https://drive.google.com/drive/folders/${batchFolder.id}`,
      timestamp,
    });
  } catch (error) {
    console.error("Google Drive backup failed", error);
    return send(res, 500, { error: `สำรองข้อมูลไม่สำเร็จ: ${error.message}` });
  }
}
