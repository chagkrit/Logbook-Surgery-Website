import React, { useEffect, useMemo, useRef, useState } from "react";
import { BookIcon, CheckIcon, ClockIcon, CloudBackupIcon, QrIcon, ShieldIcon } from "../components/Icons";
import { getYear4StudentPhotoUrl } from "../year4Api";
import { calculateProgress, statusLabels, year4Activities } from "../year4Data";
import { formatYear4Timestamp } from "../year4Time";

const Metric = ({ icon, label, value, detail }) => (
  <div className="summary-metric">
    <span className="metric-icon">{icon}</span>
    <div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
  </div>
);

function StudentPhoto({ user, onPhotoUpload }) {
  const inputRef = useRef(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [state, setState] = useState({ busy: false, message: "", error: false });

  useEffect(() => {
    let active = true;
    if (!user.avatarPath || user.avatarPath.startsWith("blob:")) {
      setPhotoUrl(user.avatarPath || "");
      return undefined;
    }
    getYear4StudentPhotoUrl(user.avatarPath)
      .then((url) => { if (active) setPhotoUrl(url); })
      .catch(() => { if (active) setState({ busy: false, message: "ไม่สามารถโหลดรูปปัจจุบันได้", error: true }); });
    return () => { active = false; };
  }, [user.avatarPath]);

  async function upload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setState({ busy: true, message: "", error: false });
    try {
      const result = await onPhotoUpload(file);
      setPhotoUrl(result.url);
      setState({ busy: false, message: "บันทึกรูปนักศึกษาแล้ว", error: false });
    } catch (error) {
      setState({ busy: false, message: error.message || "ไม่สามารถอัปโหลดรูปได้", error: true });
    } finally {
      event.target.value = "";
    }
  }

  return (
    <section className="content-panel student-photo-card">
      <div className="student-photo-preview">{photoUrl ? <img src={photoUrl} alt={`รูปของ ${user.name}`} /> : <span>{user.name.slice(0, 1)}</span>}</div>
      <div><h2>รูปนักศึกษา</h2><p>ใช้รูปหน้าตรง JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB</p>{state.message && <small className={state.error ? "photo-error" : "photo-success"} role="status">{state.message}</small>}</div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} hidden />
      <button className="secondary-button" type="button" onClick={() => inputRef.current?.click()} disabled={state.busy}>{state.busy ? "กำลังอัปโหลด…" : photoUrl ? "เปลี่ยนรูป" : "เพิ่มรูป"}</button>
    </section>
  );
}

export default function Year4Dashboard({ user, students, entries, selectedStudentId, onSelectStudent, onNavigate, onBackup, onPhotoUpload }) {
  const [backup, setBackup] = useState({ busy: false, message: "", error: false, url: "" });
  const selectedStudent = students.find((student) => student.id === selectedStudentId) || students[0] || user;
  const visibleEntries = user.role === "staff"
    ? entries.filter((entry) => entry.studentId === selectedStudent?.id)
    : entries.filter((entry) => entry.studentId === user.id);
  const progress = useMemo(() => calculateProgress(visibleEntries), [visibleEntries]);
  const measurable = progress.filter((item) => item.target !== null);
  const finished = measurable.filter((item) => item.completed >= item.target).length;
  const approved = visibleEntries.filter((entry) => entry.status === "approved").length;
  const pending = user.role === "staff"
    ? entries.filter((entry) => entry.status === "submitted" && [user.id, user.email].includes(entry.selectedApproverId)).length
    : visibleEntries.filter((entry) => entry.status === "submitted").length;
  const rejected = visibleEntries.filter((entry) => entry.status === "rejected").length;
  const recent = visibleEntries.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 5);

  async function backupNow() {
    setBackup({ busy: true, message: "", error: false, url: "" });
    try {
      const result = await onBackup();
      setBackup({ busy: false, message: `สำรอง ${result.fileName || "Year 4 Logbook"} ไป OneDrive สำเร็จ`, error: false, url: result.webUrl || "" });
    } catch (error) {
      setBackup({ busy: false, message: error.message, error: true, url: "" });
    }
  }

  return (
    <>
      <div className="page-heading year4-heading">
        <div>
          <h1>{user.role === "staff" ? "ภาพรวม Logbook นักศึกษา" : "ภาพรวม Logbook ของฉัน"}</h1>
          <p>{user.role === "staff" ? "ติดตามความครบถ้วนและรายการรออนุมัติ" : <>ยินดีต้อนรับ <strong>{user.name}</strong></>}</p>
        </div>
        <div className="dashboard-heading-actions">
          {user.role === "staff" && onBackup && <button className="secondary-button with-icon" onClick={backupNow} disabled={backup.busy}><CloudBackupIcon size={18} />{backup.busy ? "กำลังสำรอง…" : "สำรองไป OneDrive"}</button>}
          <button className="primary-button with-icon" onClick={() => onNavigate(user.role === "staff" ? "review" : "logbook")}>
            {user.role === "staff" ? <ShieldIcon size={18} /> : <BookIcon size={18} />}
            {user.role === "staff" ? `ตรวจรายการ (${pending})` : "เพิ่มกิจกรรม"}
          </button>
        </div>
      </div>

      {backup.message && <div className={`backup-message ${backup.error ? "error" : "success"}`} role="status">{backup.message}{backup.url && <> · <a href={backup.url} target="_blank" rel="noreferrer">เปิดไฟล์</a></>}</div>}

      {user.role === "student" && onPhotoUpload && <StudentPhoto user={user} onPhotoUpload={onPhotoUpload} />}

      {user.role === "staff" && (
        <div className="student-context-bar">
          <label>กำลังดูข้อมูลนักศึกษา
            <select value={selectedStudent?.id || ""} onChange={(event) => onSelectStudent(event.target.value)}>
              {students.map((student) => <option key={student.id} value={student.id}>{student.studentCode} · {student.name}</option>)}
            </select>
          </label>
          <span>{students.length} คนในระบบ</span>
        </div>
      )}

      <section className="summary-band year4-summary" aria-label="สรุปสถานะ Logbook">
        <Metric icon={<BookIcon size={24} />} label="รายการทั้งหมด" value={visibleEntries.length} detail="กิจกรรมที่บันทึก" />
        <Metric icon={<CheckIcon size={24} />} label="อนุมัติแล้ว" value={approved} detail="นำไปนับความก้าวหน้า" />
        <Metric icon={<ClockIcon size={24} />} label="รออนุมัติ" value={pending} detail={user.role === "staff" ? "ทั้งระบบ" : "ส่งให้ Staff แล้ว"} />
        <Metric icon={<ShieldIcon size={24} />} label="เป้าหมายที่ครบ" value={`${finished}/${measurable.length}`} detail={rejected ? `มี ${rejected} รายการให้แก้ไข` : "ตามเกณฑ์ปี 2568"} />
      </section>

      <div className="dashboard-grid year4-dashboard-grid">
        <section className="content-panel progress-panel">
          <div className="section-title"><div><h2>ความก้าวหน้าตามสมุด Logbook</h2><p>นับเฉพาะรายการที่ Staff อนุมัติแล้ว</p></div></div>
          <div className="year4-progress-list">
            {progress.map((item) => (
              <div className="year4-progress-row" key={item.id}>
                <div><strong>{item.title}</strong><small>{item.group}</small></div>
                <span className="progress-count">{item.completed}{item.target === null ? ` ${item.unit}` : ` / ${item.target}`}</span>
                <span className="progress-cell"><i><b style={{ width: `${item.percent ?? (item.completed ? 100 : 0)}%` }} /></i><em>{item.target === null ? "ตามจริง" : `${item.percent}%`}</em></span>
              </div>
            ))}
          </div>
        </section>

        <aside className="content-panel recent-panel">
          <div className="section-title"><div><h2>กิจกรรมล่าสุด</h2><p>{selectedStudent?.name}</p></div></div>
          {recent.length === 0 ? (
            <div className="empty-state"><BookIcon size={30} /><h3>ยังไม่มีรายการ</h3><p>เริ่มบันทึกกิจกรรมแรกใน Logbook</p></div>
          ) : (
            <ul className="activity-list">{recent.map((entry) => {
              const activity = year4Activities.find((item) => item.id === entry.activityType);
              const timestamp = entry.approvedAt || entry.submittedAt;
              const timestampLabel = entry.approvedAt ? "Staff อนุมัติ" : "นักศึกษาบันทึก";
              return <li key={entry.id}><span className={`status-dot ${entry.status}`}><QrIcon size={15} /></span><div><strong>{activity?.title || entry.activityType}</strong><small>{entry.date} · {statusLabels[entry.status]}</small>{timestamp && <small>{timestampLabel}: {formatYear4Timestamp(timestamp)}</small>}</div></li>;
            })}</ul>
          )}
        </aside>
      </div>
    </>
  );
}
