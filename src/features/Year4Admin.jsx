import React, { useEffect, useMemo, useState } from "react";
import { DownloadIcon, FileIcon, LockIcon, ShieldIcon, TrashIcon, UserIcon } from "../components/Icons";
import { exportYear4Excel, exportYear4Pdf, selectYear4ExportData } from "../year4Export";

export default function Year4Admin({ students, entries, approvalEvents, onDelete }) {
  const groups = useMemo(() => [...new Set(students.map((student) => student.studentGroup).filter(Boolean))].sort((a, b) => Number(a) - Number(b)), [students]);
  const [filter, setFilter] = useState({ scope: "all", studentId: students[0]?.id || "", studentGroup: groups[0] || "" });
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState({ text: "", error: false });
  const selected = useMemo(() => selectYear4ExportData(students, entries, approvalEvents, filter), [students, entries, approvalEvents, filter]);
  const selectedStudent = students.find((student) => student.id === filter.studentId);
  const scopeLabel = filter.scope === "all" ? "นักศึกษาทุกคน" : filter.scope === "group" ? `นักศึกษากลุ่ม ${filter.studentGroup}` : selectedStudent?.name || "นักศึกษารายคน";

  useEffect(() => {
    setFilter((current) => ({
      ...current,
      studentId: students.some((student) => student.id === current.studentId) ? current.studentId : students[0]?.id || "",
      studentGroup: groups.includes(current.studentGroup) ? current.studentGroup : groups[0] || "",
    }));
  }, [students, groups]);

  async function exportExcel() {
    setBusy("excel"); setMessage({ text: "", error: false });
    try {
      const fileName = await exportYear4Excel(selected, filter);
      setMessage({ text: `ดาวน์โหลด ${fileName} แล้ว`, error: false });
    } catch (error) {
      setMessage({ text: `สร้าง Excel ไม่สำเร็จ: ${error.message}`, error: true });
    } finally {
      setBusy("");
    }
  }

  function exportPdf() {
    setMessage({ text: "", error: false });
    try {
      exportYear4Pdf(selected, filter);
      setMessage({ text: "เปิดหน้าต่าง Print แล้ว กรุณาเลือก Save as PDF", error: false });
    } catch (error) {
      setMessage({ text: error.message, error: true });
    }
  }

  async function deleteData(event) {
    event.preventDefault();
    if (!selected.entries.length) return setMessage({ text: "ไม่มีข้อมูล Logbook ในขอบเขตที่เลือก", error: true });
    if (!window.confirm(`ยืนยันลบข้อมูล Logbook ${selected.entries.length} รายการของ ${scopeLabel}? การดำเนินการนี้ย้อนกลับไม่ได้`)) return;
    setBusy("delete"); setMessage({ text: "", error: false });
    try {
      const result = await onDelete(filter, password);
      setPassword("");
      setMessage({ text: `ลบ Logbook ${result.deletedCount || 0} รายการแล้ว บัญชี Student ยังคงอยู่`, error: false });
    } catch (error) {
      setMessage({ text: error.message || "ลบข้อมูลไม่สำเร็จ", error: true });
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <div className="page-heading"><div><h1>จัดการข้อมูล Year 4</h1><p>ส่งออกและดูแลข้อมูล Logbook ด้วยสิทธิ์ Admin</p></div></div>

      <section className="content-panel admin-filter-panel">
        <div className="section-title"><div><h2>เลือกขอบเขตข้อมูล</h2><p>ใช้ตัวกรองเดียวกันสำหรับ PDF, Excel และการลบข้อมูล</p></div><ShieldIcon size={26} /></div>
        <div className="admin-filter-grid">
          <label>ขอบเขต<select value={filter.scope} onChange={(event) => setFilter((current) => ({ ...current, scope: event.target.value }))}><option value="all">นักศึกษาทุกคน</option><option value="student">นักศึกษารายคน</option><option value="group">ตามกลุ่ม Student</option></select></label>
          {filter.scope === "student" && <label>นักศึกษา<select value={filter.studentId} onChange={(event) => setFilter((current) => ({ ...current, studentId: event.target.value }))}>{students.map((student) => <option key={student.id} value={student.id}>{student.studentGroup ? `กลุ่ม ${student.studentGroup} · ` : ""}{student.studentCode} · {student.name}</option>)}</select></label>}
          {filter.scope === "group" && <label>กลุ่มที่<select value={filter.studentGroup} onChange={(event) => setFilter((current) => ({ ...current, studentGroup: event.target.value }))}>{groups.map((group) => <option key={group} value={group}>กลุ่ม {group}</option>)}</select></label>}
        </div>
        <div className="admin-scope-summary">
          <span><UserIcon size={18} /><strong>{selected.students.length}</strong> นักศึกษา</span>
          <span><FileIcon size={18} /><strong>{selected.entries.length}</strong> รายการ Logbook</span>
          <span><ShieldIcon size={18} /><strong>{selected.entries.filter((entry) => entry.status === "approved").length}</strong> อนุมัติแล้ว</span>
        </div>
      </section>

      <div className="admin-action-grid">
        <section className="content-panel admin-export-panel">
          <div className="section-title"><div><h2>Export ข้อมูล</h2><p>{scopeLabel}</p></div><DownloadIcon size={26} /></div>
          <div className="admin-export-actions">
            <button className="primary-button with-icon" onClick={exportExcel} disabled={busy || !selected.students.length}><FileIcon size={18} />{busy === "excel" ? "กำลังสร้าง Excel…" : "ดาวน์โหลด Excel"}</button>
            <button className="secondary-button with-icon" onClick={exportPdf} disabled={busy || !selected.students.length}><FileIcon size={18} />พิมพ์ / บันทึก PDF</button>
          </div>
          <p className="admin-help">Excel มี Summary, Students, Logbook และ Approval Audit ส่วน PDF จัดหน้าแยกตามนักศึกษา</p>
        </section>

        <form className="content-panel admin-delete-panel" onSubmit={deleteData}>
          <div className="section-title"><div><h2>ลบข้อมูล Logbook</h2><p>{scopeLabel}</p></div><TrashIcon size={26} /></div>
          <div className="admin-delete-body">
            <div className="danger-note"><strong>ลบเฉพาะ Logbook และ Approval Audit ที่เกี่ยวข้อง</strong><span>บัญชี Student, รูปนักศึกษา และข้อมูล Auth จะไม่ถูกลบ</span></div>
            <label>รหัสผ่าน Admin เพื่อยืนยัน<div className="input-wrap"><LockIcon size={19} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></div></label>
            <button className="danger-button with-icon" type="submit" disabled={busy || !password || !selected.entries.length}><TrashIcon size={18} />{busy === "delete" ? "กำลังตรวจรหัสผ่านและลบ…" : `ลบ ${selected.entries.length} รายการ`}</button>
          </div>
        </form>
      </div>

      {message.text && <div className={message.error ? "form-error admin-message" : "form-success admin-message"} role="status">{message.text}</div>}
      <div className="privacy-note">ไฟล์ที่ส่งออกอาจมีรหัสเคสแบบปกปิด โปรดเก็บเฉพาะในพื้นที่ที่ภาควิชาอนุญาต และสำรองข้อมูลก่อนลบจำนวนมาก</div>
    </>
  );
}
