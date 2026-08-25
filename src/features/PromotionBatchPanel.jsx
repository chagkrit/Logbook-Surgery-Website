import React, { useEffect, useMemo, useState } from "react";
import { CheckIcon, LockIcon, ShieldIcon, UserIcon } from "../components/Icons";
import { buildPromotionCandidates, validatePromotionQueue } from "../promotionBatchLogic";

const PAGE_SIZE = 50;
const sortText = (a, b) => String(a || "").localeCompare(String(b || ""), "th", { numeric: true });

export default function PromotionBatchPanel({ students, curricula, enrollments, rotations, certifications, promotions, onPromote, onRollback }) {
  const sourceCurricula = useMemo(() => curricula.filter((curriculum) => students.some((student) => student.activeEnrollment?.curriculumId === curriculum.id)).sort((a, b) => b.academicYear - a.academicYear || a.classYear - b.classYear), [curricula, students]);
  const [sourceCurriculumId, setSourceCurriculumId] = useState("");
  const [destinationCurriculumId, setDestinationCurriculumId] = useState("");
  const [filters, setFilters] = useState({ group: "all", certification: "all", query: "" });
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [destinationGroup, setDestinationGroup] = useState("");
  const [destinationRotationId, setDestinationRotationId] = useState("");
  const [queue, setQueue] = useState([]);
  const [password, setPassword] = useState("");
  const [rollbackForm, setRollbackForm] = useState({ batchId: "", reason: "", password: "" });
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState({ text: "", error: false });

  useEffect(() => { if (!sourceCurriculumId && sourceCurricula[0]) setSourceCurriculumId(sourceCurricula[0].id); }, [sourceCurricula, sourceCurriculumId]);
  const source = curricula.find((item) => item.id === sourceCurriculumId);
  const destinationCurricula = useMemo(() => source ? curricula.filter((item) => item.status === "published" && item.classYear === source.classYear + 1 && item.academicYear === source.academicYear + 1) : [], [curricula, source]);
  useEffect(() => {
    if (!destinationCurricula.some((item) => item.id === destinationCurriculumId)) setDestinationCurriculumId(destinationCurricula[0]?.id || "");
  }, [destinationCurricula, destinationCurriculumId]);
  const candidates = useMemo(() => buildPromotionCandidates(students, sourceCurriculumId, certifications), [students, sourceCurriculumId, certifications]);
  const groups = useMemo(() => [...new Set(candidates.map((item) => item.enrollment.groupCode).filter(Boolean))].sort(sortText), [candidates]);
  const filtered = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return candidates.filter((item) => (filters.group === "all" || item.enrollment.groupCode === filters.group)
      && (filters.certification === "all" || (filters.certification === "certified") === item.certified)
      && (!query || `${item.name} ${item.studentCode}`.toLowerCase().includes(query)));
  }, [candidates, filters]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const destinationRotations = rotations.filter((item) => item.curriculumId === destinationCurriculumId && item.status !== "archived");
  const groupRotations = destinationRotations.filter((item) => !destinationGroup || item.groupCode === destinationGroup);
  const validation = useMemo(() => validatePromotionQueue(queue, destinationCurriculumId, rotations, enrollments), [queue, destinationCurriculumId, rotations, enrollments]);
  const queueGroups = useMemo(() => [...new Set(queue.map((item) => item.destinationGroup))].sort(sortText), [queue]);
  const batchGroups = useMemo(() => {
    const map = new Map();
    (promotions || []).filter((item) => item.action === "promote" && item.promotion_batch_id).forEach((item) => {
      const rows = map.get(item.promotion_batch_id) || [];
      rows.push(item); map.set(item.promotion_batch_id, rows);
    });
    return [...map.entries()].sort((a, b) => new Date(b[1][0].created_at) - new Date(a[1][0].created_at));
  }, [promotions]);
  const rolledBackBatches = useMemo(() => new Set((promotions || []).filter((item) => item.action === "rollback").map((item) => item.promotion_batch_id).filter(Boolean)), [promotions]);

  function changeSource(value) {
    setSourceCurriculumId(value); setDestinationCurriculumId(""); setSelectedIds([]); setQueue([]); setPage(1); setFilters({ group: "all", certification: "all", query: "" });
  }
  function selectRows(rows) { setSelectedIds((current) => [...new Set([...current, ...rows.map((item) => item.id)])]); }
  function toggleStudent(id) { setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  function addQueue() {
    if (!destinationCurriculumId) return setMessage({ text: "Curriculum ชั้นปีและปีการศึกษาถัดไปยังไม่ Published", error: true });
    if (!selectedIds.length || !destinationGroup || !destinationRotationId) return setMessage({ text: "กรุณาเลือกนักศึกษา กลุ่มใหม่ และ rotation", error: true });
    const selected = candidates.filter((item) => selectedSet.has(item.id));
    setQueue((current) => {
      const queued = new Set(current.map((item) => item.studentId));
      return [...current, ...selected.filter((item) => !queued.has(item.id)).map((item) => ({
        studentId: item.id, name: item.name, studentCode: item.studentCode, certified: item.certified,
        destinationGroup, destinationRotationId, override: false, overrideReason: "",
      }))];
    });
    setSelectedIds([]); setMessage({ text: `เพิ่มนักศึกษา ${selected.length} คนเข้าคิวแล้ว`, error: false });
  }
  function updateQueue(studentId, patch) { setQueue((current) => current.map((item) => item.studentId === studentId ? { ...item, ...patch } : item)); }

  async function promote(event) {
    event.preventDefault();
    if (validation.total === 0 || validation.ready !== validation.total) return setMessage({ text: "กรุณาแก้รายการที่ไม่ผ่าน validation ให้ครบก่อน", error: true });
    if (!window.confirm(`ยืนยันเลื่อนชั้นนักศึกษา ${validation.total} คนแบบทั้งชุด?`)) return;
    setBusy("promote");
    try {
      const assignments = queue.map(({ studentId, destinationGroup: group, destinationRotationId: rotationId, override, overrideReason }) => ({ studentId, destinationGroup: group, destinationRotationId: rotationId, override, overrideReason }));
      const result = await onPromote({ destinationCurriculumId, assignments, password });
      setQueue([]); setSelectedIds([]); setPassword("");
      setMessage({ text: `เลื่อนชั้นสำเร็จ ${result.promotedCount || assignments.length} คน · Batch ${String(result.batchId || "").slice(0, 8)}`, error: false });
    } catch (error) { setMessage({ text: error.message, error: true }); }
    finally { setBusy(""); }
  }

  async function rollbackBatch(event) {
    event.preventDefault(); setBusy(`rollback-${rollbackForm.batchId}`);
    try {
      const result = await onRollback(rollbackForm.batchId, rollbackForm.reason, rollbackForm.password);
      setRollbackForm({ batchId: "", reason: "", password: "" });
      setMessage({ text: `Rollback ทั้ง batch สำเร็จ ${result.restoredCount || ""} คน`, error: false });
    } catch (error) { setMessage({ text: error.message, error: true }); }
    finally { setBusy(""); }
  }

  return <>
    <form className="curriculum-card promotion-card" onSubmit={promote}>
      <div className="promotion-heading"><div><h3>3. Promotion Batch</h3><p>เลือกและจัดกลุ่มนักศึกษาข้ามหน้า แล้วเลื่อนทั้งรุ่นแบบ all-or-nothing</p></div><span>{queue.length} คนในคิว</span></div>
      <div className="promotion-filters">
        <label>ชั้นปี / ปีการศึกษาต้นทาง<select value={sourceCurriculumId} onChange={(event) => changeSource(event.target.value)}><option value="">ไม่มีนักศึกษา active</option>{sourceCurricula.map((item) => <option key={item.id} value={item.id}>Year {item.classYear} / {item.academicYear}</option>)}</select></label>
        <label>กลุ่มเดิม<select value={filters.group} onChange={(event) => { setFilters({ ...filters, group: event.target.value }); setPage(1); }}><option value="all">ทุกกลุ่ม</option>{groups.map((group) => <option key={group}>{group}</option>)}</select></label>
        <label>สถานะรับรอง<select value={filters.certification} onChange={(event) => { setFilters({ ...filters, certification: event.target.value }); setPage(1); }}><option value="all">ทั้งหมด</option><option value="certified">Certified</option><option value="uncertified">ยังไม่ Certified</option></select></label>
        <label>ชื่อ / รหัสนักศึกษา<input value={filters.query} onChange={(event) => { setFilters({ ...filters, query: event.target.value }); setPage(1); }} placeholder="ค้นหา…" /></label>
      </div>
      <div className="promotion-select-actions"><span>ผลกรอง {filtered.length} คน · เลือกแล้ว {selectedIds.length} คน</span><div><button type="button" className="secondary-button" onClick={() => selectRows(filtered)}>เลือกทั้งหมดในผลกรอง</button><button type="button" className="secondary-button" onClick={() => selectRows(filtered.filter((item) => item.certified))}>เลือกเฉพาะผู้ผ่านเกณฑ์</button><button type="button" className="text-button" onClick={() => setSelectedIds([])}>ล้างที่เลือก</button></div></div>
      <div className="promotion-table-wrap"><table className="promotion-table"><thead><tr><th aria-label="เลือก" /><th>นักศึกษา</th><th>กลุ่มเดิม</th><th>สถานะ</th></tr></thead><tbody>{pageRows.map((student) => <tr key={student.id} className={student.certified ? "" : "not-certified"}><td><input type="checkbox" checked={selectedSet.has(student.id)} onChange={() => toggleStudent(student.id)} aria-label={`เลือก ${student.name}`} /></td><td><div><UserIcon size={17} /><span><strong>{student.name}</strong><small>{student.studentCode || "ไม่มีรหัสนักศึกษา"}</small></span></div></td><td>{student.enrollment.groupCode}</td><td><span className={`promotion-status ${student.certified ? "ready" : "warning"}`}>{student.certified ? "Certified" : "ยังไม่ Certified"}</span></td></tr>)}</tbody></table>{!pageRows.length && <p className="empty-message">ไม่พบนักศึกษาตามตัวกรอง</p>}</div>
      <div className="promotion-pagination"><button type="button" className="text-button" disabled={page <= 1} onClick={() => setPage(page - 1)}>ก่อนหน้า</button><span>หน้า {page} / {pageCount} · แสดงสูงสุด 50 คน</span><button type="button" className="text-button" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>ถัดไป</button></div>
      <div className="promotion-assignment"><h4>กำหนดปลายทางให้รายการที่เลือก</h4><div className="promotion-filters"><label>Curriculum ปลายทาง<select value={destinationCurriculumId} onChange={(event) => { setDestinationCurriculumId(event.target.value); setDestinationGroup(""); setDestinationRotationId(""); }}><option value="">ต้องเป็นปีถัดไปและ Published</option>{destinationCurricula.map((item) => <option key={item.id} value={item.id}>Year {item.classYear} / {item.academicYear}</option>)}</select></label><label>กลุ่มใหม่<select value={destinationGroup} onChange={(event) => { setDestinationGroup(event.target.value); setDestinationRotationId(""); }}><option value="">เลือกกลุ่มจาก rotation</option>{[...new Set(destinationRotations.map((item) => item.groupCode))].sort(sortText).map((group) => <option key={group}>{group}</option>)}</select></label><label>Rotation<select value={destinationRotationId} onChange={(event) => setDestinationRotationId(event.target.value)}><option value="">เลือก rotation ที่ตรงกับกลุ่ม</option>{groupRotations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button type="button" className="secondary-button with-icon" onClick={addQueue} disabled={!selectedIds.length}><CheckIcon size={17} />เพิ่มเข้าคิว</button></div></div>

      <div className="promotion-preview"><h4>ตรวจสอบทั้งรุ่นก่อนยืนยัน</h4><div className="promotion-metrics"><span><strong>{validation.total}</strong>ทั้งหมด</span><span className="ready"><strong>{validation.ready}</strong>พร้อมเลื่อน</span><span className={validation.uncertified ? "warning" : ""}><strong>{validation.uncertified}</strong>ยังไม่ certified</span><span className={validation.missing ? "warning" : ""}><strong>{validation.missing}</strong>กลุ่ม/rotation ไม่ครบ</span><span className={validation.duplicates ? "warning" : ""}><strong>{validation.duplicates}</strong>ซ้ำในคิว</span><span className={validation.alreadyDestination ? "warning" : ""}><strong>{validation.alreadyDestination}</strong>อยู่ปลายทางแล้ว</span></div>
        {queueGroups.map((group) => <details key={group} className="promotion-queue-group" open><summary>กลุ่มใหม่ {group} · {queue.filter((item) => item.destinationGroup === group).length} คน</summary>{queue.filter((item) => item.destinationGroup === group).map((item) => <div key={item.studentId} className={!item.certified ? "needs-override" : ""}><span><strong>{item.name}</strong><small>{item.studentCode || item.studentId.slice(0, 8)}</small></span>{!item.certified && <label className="queue-override"><input type="checkbox" checked={item.override} onChange={(event) => updateQueue(item.studentId, { override: event.target.checked, overrideReason: event.target.checked ? item.overrideReason : "" })} />Override</label>}{item.override && <input className="override-reason" value={item.overrideReason} onChange={(event) => updateQueue(item.studentId, { overrideReason: event.target.value })} placeholder="เหตุผลบังคับรายคน" />}<button type="button" className="text-button danger-text" onClick={() => setQueue((current) => current.filter((row) => row.studentId !== item.studentId))}>นำออก</button></div>)}</details>)}
      </div>
      <label>รหัสผ่าน Admin<div className="input-wrap"><LockIcon size={18} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></div></label>
      <button className="primary-button with-icon promotion-submit" disabled={busy || !password || validation.total === 0 || validation.ready !== validation.total}><ShieldIcon size={18} />{busy === "promote" ? "กำลังเลื่อนชั้นทั้ง batch…" : `ยืนยันเลื่อนชั้น ${validation.total} คน`}</button>
    </form>
    {batchGroups.length > 0 && <details className="promotion-audit"><summary>ประวัติ Promotion Batch {batchGroups.length} ชุด</summary>{batchGroups.map(([batchId, rows]) => { const rolledBack = rolledBackBatches.has(batchId); return <div key={batchId}><span>{new Date(rows[0].created_at).toLocaleString("th-TH")} · {rows.length} คน · Batch {batchId.slice(0, 8)}</span><code>{rows.filter((item) => item.override_used).length} Override</code><button className="danger-button" type="button" disabled={busy || rolledBack} onClick={() => setRollbackForm({ batchId, reason: "", password: "" })}>{rolledBack ? "Rollback แล้ว" : "Rollback ทั้ง batch"}</button></div>; })}</details>}
    {rollbackForm.batchId && <form className="promotion-rollback-form" onSubmit={rollbackBatch}><strong>Rollback Batch {rollbackForm.batchId.slice(0, 8)}</strong><label>เหตุผล<textarea value={rollbackForm.reason} onChange={(event) => setRollbackForm({ ...rollbackForm, reason: event.target.value })} required /></label><label>รหัสผ่าน Admin<input type="password" value={rollbackForm.password} onChange={(event) => setRollbackForm({ ...rollbackForm, password: event.target.value })} required /></label><div><button type="button" className="secondary-button" onClick={() => setRollbackForm({ batchId: "", reason: "", password: "" })}>ยกเลิก</button><button className="danger-button" disabled={busy}>ยืนยัน Rollback ทั้งชุด</button></div></form>}
    {message.text && <div className={message.error ? "form-error" : "form-success"} role="status">{message.text}</div>}
  </>;
}
