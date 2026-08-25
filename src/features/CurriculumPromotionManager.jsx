import React, { useEffect, useMemo, useState } from "react";
import { BookIcon, CheckIcon, FileIcon, LockIcon, ShieldIcon, UserIcon } from "../components/Icons";
import { defaultAcademicYear, defaultStartingClassYear } from "../appConfig";

const blankCurriculum = { code: "", classYear: defaultStartingClassYear, academicYear: defaultAcademicYear, name: "Surgery Logbook Year 5", passPercent: 80, version: 1, status: "draft", sourceFilename: "" };

function booleanValue(value) {
  return [true, 1, "1", "true", "yes", "y", "ใช่"].includes(typeof value === "string" ? value.trim().toLowerCase() : value);
}

async function readActivities(file) {
  if (!/\.(xlsx|csv)$/i.test(file.name)) throw new Error("รองรับไฟล์นำเข้า .xlsx หรือ .csv; ไฟล์ PDF จะนำเข้าหลังได้รับแบบฟอร์มปี 5 จริง");
  let rows;
  if (/\.csv$/i.test(file.name)) {
    const lines = (await file.text()).split(/\r?\n/).filter(Boolean);
    const headers = lines.shift().split(",").map((item) => item.trim());
    rows = lines.map((line) => Object.fromEntries(line.split(",").map((value, index) => [headers[index], value.trim()])));
  } else {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheet = workbook.worksheets[0];
    const headers = sheet.getRow(1).values.slice(1).map((value) => String(value || "").trim());
    rows = [];
    sheet.eachRow((row, index) => { if (index > 1) rows.push(Object.fromEntries(row.values.slice(1).map((value, column) => [headers[column], value]))); });
  }
  const normalized = rows.map((row, index) => ({
    id: String(row.activity_code || row.id || "").trim(),
    title: String(row.title_th || row.title || "").trim(),
    group: String(row.group_name || row.group || "").trim(),
    target: row.target_count === "" || row.target_count == null ? null : Number(row.target_count),
    unit: String(row.target_unit || row.unit || "ครั้ง").trim(),
    sortOrder: Number(row.sort_order || index + 1),
    fields: [booleanValue(row.requires_week) && "week", booleanValue(row.requires_patient) && "patient", booleanValue(row.requires_procedure) && "procedure", "supervisor", "detail"].filter(Boolean),
  }));
  if (!normalized.length || normalized.some((item) => !item.id || !item.title || !item.group || !Number.isFinite(item.sortOrder))) throw new Error("ไฟล์ต้องมี activity_code, title_th, group_name และ sort_order ที่ถูกต้อง");
  if (new Set(normalized.map((item) => item.id)).size !== normalized.length) throw new Error("พบ activity_code ซ้ำในไฟล์");
  return normalized;
}

export default function CurriculumPromotionManager({ students, curricula, activities, enrollments, rotations, certifications, promotions, onSaveCurriculum, onImportActivities, onPublish, onPromote, onRollback }) {
  const [form, setForm] = useState(blankCurriculum);
  const [selectedCurriculumId, setSelectedCurriculumId] = useState("");
  const [previewActivities, setPreviewActivities] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [groupCode, setGroupCode] = useState("");
  const [rotationId, setRotationId] = useState("");
  const [override, setOverride] = useState(false);
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState({ text: "", error: false });
  const selectedCurriculum = curricula.find((item) => item.id === selectedCurriculumId);
  const draftCurricula = curricula.filter((item) => item.status === "draft");
  const savedActivities = activities.filter((item) => item.curriculumId === form.id);
  const displayedActivities = previewActivities.length ? previewActivities : savedActivities;
  const destinationCurricula = curricula.filter((item) => item.status === "published" && item.classYear >= 5);
  const destinationRotations = rotations.filter((item) => item.curriculumId === selectedCurriculumId);
  const eligibleMap = useMemo(() => new Map(students.map((student) => {
    const active = student.activeEnrollment;
    const certified = active && certifications.some((item) => item.enrollmentId === active.id && item.status === "certified");
    return [student.id, { active, certified }];
  })), [students, certifications]);
  const rolledBackPromotionIds = useMemo(() => new Set((promotions || []).filter((item) => item.action === "rollback").map((item) => item.related_promotion_id)), [promotions]);

  useEffect(() => {
    if (form.id || !draftCurricula.length) return;
    const draft = draftCurricula[0];
    setForm({ ...blankCurriculum, ...draft });
  }, [draftCurricula, form.id]);

  async function saveDraft(event) {
    event.preventDefault(); setBusy("save"); setMessage({ text: "", error: false });
    try { const saved = await onSaveCurriculum(form); setForm({ ...form, ...saved }); setSelectedCurriculumId(saved.id); setMessage({ text: "สร้าง Draft Curriculum แล้ว กรุณานำเข้ากิจกรรมก่อน Publish", error: false }); }
    catch (error) { setMessage({ text: error.message, error: true }); } finally { setBusy(""); }
  }

  async function chooseFile(event) {
    const file = event.target.files?.[0]; if (!file) return;
    try { const parsed = await readActivities(file); setPreviewActivities(parsed); setForm((current) => ({ ...current, sourceFilename: file.name })); setMessage({ text: `อ่าน ${parsed.length} กิจกรรมจาก ${file.name} แล้ว`, error: false }); }
    catch (error) { setPreviewActivities([]); setMessage({ text: error.message, error: true }); }
  }

  async function importActivities() {
    if (!form.id || !previewActivities.length) return;
    setBusy("import");
    try { await onImportActivities(form.id, previewActivities, form.sourceFilename); setMessage({ text: `นำเข้า ${previewActivities.length} กิจกรรมแล้ว`, error: false }); }
    catch (error) { setMessage({ text: error.message, error: true }); } finally { setBusy(""); }
  }

  function selectDraft(id) {
    const draft = draftCurricula.find((item) => item.id === id);
    setForm(draft ? { ...blankCurriculum, ...draft } : blankCurriculum);
    setPreviewActivities([]);
    setMessage({ text: "", error: false });
  }

  async function publish() {
    if (!window.confirm("ยืนยัน Publish Curriculum? หลัง Publish จะไม่สามารถแก้รายการกิจกรรมได้")) return;
    setBusy("publish"); try { await onPublish(form.id); setMessage({ text: "Publish Curriculum แล้ว สามารถใช้เลื่อนชั้นได้", error: false }); }
    catch (error) { setMessage({ text: error.message, error: true }); } finally { setBusy(""); }
  }

  async function promote(event) {
    event.preventDefault();
    if (!selectedStudents.length) return setMessage({ text: "กรุณาเลือกนักศึกษาอย่างน้อย 1 คน", error: true });
    if (!window.confirm(`ยืนยันเลื่อนชั้นนักศึกษา ${selectedStudents.length} คน?`)) return;
    setBusy("promote");
    try { const result = await onPromote({ studentIds: selectedStudents, destinationCurriculumId: selectedCurriculumId, destinationGroup: groupCode, destinationRotationId: rotationId || null, override, reason, password }); setSelectedStudents([]); setPassword(""); setMessage({ text: `เลื่อนชั้นสำเร็จ ${result.promotedCount || selectedStudents.length} คน`, error: false }); }
    catch (error) { setMessage({ text: error.message, error: true }); } finally { setBusy(""); }
  }

  async function rollback(item) {
    const rollbackReason = window.prompt("ระบุเหตุผล rollback การเลื่อนชั้น");
    if (!rollbackReason) return;
    const rollbackPassword = window.prompt("กรอกรหัสผ่าน Admin เพื่อยืนยัน");
    if (!rollbackPassword) return;
    setBusy(`rollback-${item.id}`); try { await onRollback(item.id, rollbackReason, rollbackPassword); setMessage({ text: "Rollback การเลื่อนชั้นแล้ว", error: false }); }
    catch (error) { setMessage({ text: error.message, error: true }); } finally { setBusy(""); }
  }

  return <section className="content-panel curriculum-manager">
    <div className="section-title"><div><h2>Curriculum และการเลื่อนชั้น</h2><p>ใช้บัญชีและ QR เดิม พร้อมแยก Logbook ตามชั้นปีและปีการศึกษา</p></div><BookIcon size={27} /></div>
    <div className="curriculum-grid">
      <form className="curriculum-card" onSubmit={saveDraft}><h3>1. สร้างหรือเปิด Draft Curriculum</h3>
        {draftCurricula.length > 0 && <label>Draft ที่มีอยู่<select value={form.id || ""} onChange={(event) => selectDraft(event.target.value)}><option value="">สร้าง Draft ใหม่</option>{draftCurricula.map((item) => <option key={item.id} value={item.id}>Year {item.classYear} · {item.academicYear} · {item.name}</option>)}</select></label>}
        <label>รหัส Curriculum<input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="surgery-y5-2569" pattern="[a-z0-9-]{3,50}" required /></label>
        <div className="admin-filter-grid"><label>ชั้นปี<input type="number" min="4" max="6" value={form.classYear} onChange={(event) => setForm({ ...form, classYear: event.target.value })} required /></label><label>ปีการศึกษา<input type="number" min="2500" max="2700" value={form.academicYear} onChange={(event) => setForm({ ...form, academicYear: event.target.value })} required /></label></div>
        <label>ชื่อ<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
        <label>เกณฑ์ผ่าน (%)<input type="number" min="1" max="100" value={form.passPercent} onChange={(event) => setForm({ ...form, passPercent: event.target.value })} required /></label>
        <button className="primary-button" disabled={busy || form.id}>{busy === "save" ? "กำลังบันทึก…" : form.id ? "เปิด Draft แล้ว" : "สร้าง Draft"}</button>
      </form>
      <div className="curriculum-card"><h3>2. นำเข้ากิจกรรมและ Publish</h3>
        {form.sourceFilename && <p className="admin-help">ต้นฉบับ: {form.sourceFilename} · สถานะ Draft จะไม่ปรากฏแก่ Student และยังใช้เลื่อนชั้นไม่ได้</p>}
        <label>ไฟล์ Curriculum (.xlsx/.csv)<input type="file" accept=".xlsx,.csv" onChange={chooseFile} disabled={!form.id} /></label>
        <p className="admin-help">คอลัมน์: activity_code, title_th, group_name, target_count, target_unit, sort_order, requires_patient, requires_procedure, requires_week</p>
        <div className="curriculum-preview"><strong>{displayedActivities.length} กิจกรรม</strong><span>เป้าหมายรวม {displayedActivities.reduce((sum, item) => sum + (item.target || 0), 0)}</span></div>
        {displayedActivities.length > 0 && <div className="curriculum-activity-preview">{displayedActivities.map((item) => <div key={item.id}><span>{item.sortOrder}. {item.title}</span><strong>{item.target == null ? "ตามจริง" : `${item.target} ${item.unit}`}</strong></div>)}</div>}
        <div className="admin-export-actions"><button className="secondary-button with-icon" type="button" onClick={importActivities} disabled={busy || !form.id || !previewActivities.length}><FileIcon size={17} />นำเข้าแทนรายการเดิม</button><button className="primary-button with-icon" type="button" onClick={publish} disabled={busy || !form.id || !displayedActivities.length}><CheckIcon size={17} />Publish หลังตรวจสอบ</button></div>
      </div>
    </div>
    <form className="curriculum-card promotion-card" onSubmit={promote}><h3>3. เลื่อนชั้น Student</h3>
      <div className="admin-filter-grid"><label>Curriculum ปลายทาง<select value={selectedCurriculumId} onChange={(event) => { setSelectedCurriculumId(event.target.value); setRotationId(""); }} required><option value="">เลือก Curriculum ที่ Publish แล้ว</option>{destinationCurricula.map((item) => <option key={item.id} value={item.id}>Year {item.classYear} · {item.academicYear} · {item.name}</option>)}</select></label><label>กลุ่มใหม่<input value={groupCode} onChange={(event) => setGroupCode(event.target.value.replace(/[^0-9A-Za-z-]/g, ""))} required /></label><label>Rotation<select value={rotationId} onChange={(event) => setRotationId(event.target.value)}><option value="">ยังไม่กำหนด</option>{destinationRotations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
      <div className="promotion-student-list">{students.map((student) => { const eligibility = eligibleMap.get(student.id); const alreadyDestination = eligibility?.active?.curriculumId === selectedCurriculumId; return <label key={student.id} className={!eligibility?.certified ? "not-certified" : ""}><input type="checkbox" checked={selectedStudents.includes(student.id)} disabled={alreadyDestination || (!eligibility?.certified && !override)} onChange={(event) => setSelectedStudents((current) => event.target.checked ? [...current, student.id] : current.filter((id) => id !== student.id))} /><UserIcon size={17} /><span><strong>{student.name}</strong><small>Year {student.classYear || 4} · กลุ่ม {student.studentGroup || "—"} · {eligibility?.certified ? "รับรองแล้ว" : "ยังไม่รับรอง"}</small></span></label>; })}</div>
      <label className="override-check"><input type="checkbox" checked={override} onChange={(event) => { setOverride(event.target.checked); setSelectedStudents([]); }} />อนุญาต override กรณียังไม่รับรอง</label>
      {override && <label>เหตุผล override<textarea rows="2" value={reason} onChange={(event) => setReason(event.target.value)} required /></label>}
      <label>รหัสผ่าน Admin<div className="input-wrap"><LockIcon size={18} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></div></label>
      <button className="primary-button with-icon" disabled={busy || !selectedCurriculum || !selectedStudents.length || !password}><ShieldIcon size={18} />{busy === "promote" ? "กำลังเลื่อนชั้น…" : `เลื่อนชั้น ${selectedStudents.length} คน`}</button>
    </form>
    {promotions?.length > 0 && <details className="promotion-audit"><summary>ประวัติการเลื่อนชั้น {promotions.length} รายการ</summary>{promotions.filter((item) => item.action === "promote").slice(0, 20).map((item) => { const student = students.find((person) => person.id === item.student_id); const rolledBack = rolledBackPromotionIds.has(item.id); return <div key={item.id}><span>{new Date(item.created_at).toLocaleString("th-TH")} · {student?.name || item.student_id.slice(0, 8)}</span><code>{item.override_used ? "Override" : "Certified"}</code><button className="danger-button" type="button" disabled={busy || rolledBack} onClick={() => rollback(item)}>{rolledBack ? "Rollback แล้ว" : "Rollback"}</button></div>; })}</details>}
    {message.text && <div className={message.error ? "form-error" : "form-success"} role="status">{message.text}</div>}
  </section>;
}
