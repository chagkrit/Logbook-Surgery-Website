import React, { useMemo, useState } from "react";
import { AlertIcon, ChartIcon, ClockIcon, ShieldIcon } from "../components/Icons";
import { programQualitySummary } from "../year4Analytics";

export default function Year4QualityDashboard({ students, entries, rotations = [], compact = false }) {
  const years = useMemo(() => [...new Set(students.map((student) => student.cohortYear).filter(Boolean))].sort((a, b) => b - a), [students]);
  const groups = useMemo(() => [...new Set(students.map((student) => student.studentGroup).filter(Boolean))].sort((a, b) => Number(a) - Number(b)), [students]);
  const [year, setYear] = useState("all");
  const [group, setGroup] = useState("all");
  const filteredStudents = useMemo(() => students.filter((student) => (year === "all" || String(student.cohortYear) === year) && (group === "all" || student.studentGroup === group)), [students, year, group]);
  const filteredEntries = useMemo(() => {
    const studentIds = new Set(filteredStudents.map((student) => student.id));
    const studentMap = new Map(filteredStudents.map((student) => [student.id, student]));
    return entries.filter((entry) => studentIds.has(entry.studentId) && (!entry.academicYear || entry.academicYear === studentMap.get(entry.studentId)?.cohortYear));
  }, [entries, filteredStudents]);
  const quality = useMemo(() => programQualitySummary(filteredStudents, filteredEntries, rotations), [filteredStudents, filteredEntries, rotations]);
  const rows = compact ? quality.monitoring.filter((student) => student.atRisk || student.stalePending || student.rejected).slice(0, 8) : quality.monitoring;

  return (
    <section className="content-panel quality-dashboard">
      <div className="section-title quality-title"><div><h2>Dashboard นักศึกษาที่ต้องติดตาม</h2><p>ความก้าวหน้า ความล่าช้าในการอนุมัติ และความผิดปกติของข้อมูล</p></div><ChartIcon size={27} /></div>
      <div className="quality-filters">
        <label>ปีการศึกษา<select value={year} onChange={(event) => setYear(event.target.value)}><option value="all">ทุกปีการศึกษา</option>{years.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label>กลุ่ม Student<select value={group} onChange={(event) => setGroup(event.target.value)}><option value="all">ทุกกลุ่ม</option>{groups.map((item) => <option key={item} value={item}>กลุ่ม {item}</option>)}</select></label>
      </div>
      <div className="quality-metrics">
        <div><ShieldIcon size={20} /><span>ความก้าวหน้าเฉลี่ย<strong>{quality.averageProgress}%</strong></span></div>
        <div><AlertIcon size={20} /><span>ต้องติดตาม<strong>{quality.atRiskCount} คน</strong></span></div>
        <div><ClockIcon size={20} /><span>ค้างเกิน 48 ชม.<strong>{quality.stalePendingCount} รายการ</strong></span></div>
        <div><AlertIcon size={20} /><span>ข้อมูลผิดปกติ<strong>{quality.anomalies.length} จุด</strong></span></div>
        {!compact && <div><ClockIcon size={20} /><span>เวลาอนุมัติเฉลี่ย<strong>{quality.averageApprovalHours} ชม.</strong></span></div>}
      </div>
      <div className="quality-table-wrap"><table className="quality-table"><thead><tr><th>นักศึกษา</th><th>กลุ่ม</th><th>ความก้าวหน้า</th><th>รออนุมัติ</th><th>ส่งกลับ</th><th>สถานะติดตาม</th></tr></thead><tbody>
        {rows.map((student) => <tr key={student.id}><td><strong>{student.name}</strong><small>{student.studentCode}</small></td><td>{student.studentGroup || "—"}</td><td><strong className={student.percent >= 80 ? "quality-good" : "quality-risk"}>{student.completed}/{student.required} · {student.percent}%</strong></td><td>{student.pending}{student.stalePending ? <small className="quality-risk">เกิน 48 ชม. {student.stalePending}</small> : null}</td><td>{student.rejected}</td><td><span className={student.atRisk ? "risk-badge danger" : student.percent >= 80 ? "risk-badge good" : "risk-badge warning"}>{student.atRisk ? "ควรติดตาม" : student.percent >= 80 ? "ผ่าน 80%" : "กำลังดำเนินการ"}</span></td></tr>)}
        {!rows.length && <tr><td colSpan="6" className="quality-empty">ยังไม่มีนักศึกษาที่เข้าเงื่อนไข</td></tr>}
      </tbody></table></div>
      {!compact && quality.anomalies.length > 0 && <details className="anomaly-list"><summary>ตรวจพบข้อมูลผิดปกติ {quality.anomalies.length} จุด</summary>{quality.anomalies.slice(0, 20).map((item, index) => { const student = students.find((person) => person.id === item.studentId); return <div key={`${item.entryId}-${item.type}-${index}`}><AlertIcon size={16} /><span><strong>{student?.name || "ไม่ทราบชื่อ"}</strong> · {item.message} · Entry {item.entryId.slice(0, 8)}</span></div>; })}</details>}
    </section>
  );
}
