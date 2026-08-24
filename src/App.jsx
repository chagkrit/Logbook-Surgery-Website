import React, { useEffect, useState } from "react";
import AppShell from "./components/AppShell";
import LoginPage from "./features/LoginPage";
import StaffReview from "./features/StaffReview";
import StudentQr from "./features/StudentQr";
import StudentQrModal from "./features/StudentQrModal";
import UpdatePasswordPage from "./features/UpdatePasswordPage";
import Year4Dashboard from "./features/Year4Dashboard";
import Year4Admin from "./features/Year4Admin";
import Year4Logbook from "./features/Year4Logbook";
import { demoAdmin, demoCertifications, demoEntries, demoRotations, demoStaff, demoStaffDirectory, demoStudents } from "./year4Data";
import {
  activateYear4Account,
  backupYear4ToGoogleDrive,
  createYear4Entry,
  deleteYear4AdminAvatars,
  deleteYear4AdminData,
  deleteYear4AdminEntry,
  getCurrentYear4Profile,
  loadYear4Record,
  requestYear4PasswordReset,
  reviewYear4Certification,
  reviewYear4Entry,
  saveYear4Rotation,
  signInYear4,
  signOutYear4,
  subscribeToYear4Auth,
  submitYear4Certification,
  updateYear4Entry,
  updateYear4Password,
  uploadYear4StudentPhoto,
} from "./year4Api";

const demoRole = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("demo") : null;
const demoUser = demoRole === "admin" ? demoAdmin : demoRole === "staff" ? demoStaff : demoRole === "student" ? demoStudents[0] : null;
const emptyRecord = { students: [], staff: [], entries: [], approvalEvents: [], rotations: [], certifications: [] };
const evaluationToken = window.location.pathname.startsWith("/evaluate/")
  ? decodeURIComponent(window.location.pathname.split("/").filter(Boolean).pop() || "")
  : "";
const demoEvaluationStudent = demoUser?.role === "staff" && evaluationToken
  ? demoStudents.find((student) => student.qrToken.toLocaleLowerCase() === evaluationToken.toLocaleLowerCase())
  : null;

export default function App() {
  const [user, setUser] = useState(demoUser);
  const [record, setRecord] = useState(demoUser ? { students: demoStudents, staff: demoStaffDirectory, entries: demoEntries, approvalEvents: [], rotations: demoRotations, certifications: demoCertifications } : emptyRecord);
  const [activeTab, setActiveTab] = useState(demoUser?.role === "admin" ? "admin" : demoEvaluationStudent ? "review" : "dashboard");
  const [selectedStudentId, setSelectedStudentId] = useState(demoEvaluationStudent?.id || (demoUser ? demoStudents[0].id : ""));
  const [authReady, setAuthReady] = useState(Boolean(demoUser));
  const [syncStatus, setSyncStatus] = useState(demoUser ? "synced" : "connecting");
  const [recoveryMode, setRecoveryMode] = useState(() => window.location.pathname === "/reset-password" || window.location.hash.includes("type=recovery"));
  const [authMessage, setAuthMessage] = useState("");
  const [qrPopupEntry, setQrPopupEntry] = useState(null);

  async function refreshRecord(profile) {
    setSyncStatus("connecting");
    try {
      const nextRecord = await loadYear4Record(profile);
      setRecord(nextRecord);
      if (profile.role === "staff") {
        const scannedStudent = evaluationToken
          ? nextRecord.students.find((student) => student.qrToken.toLocaleLowerCase() === evaluationToken.toLocaleLowerCase())
          : null;
        if (scannedStudent) {
          setSelectedStudentId(scannedStudent.id);
          setActiveTab("review");
        } else {
          setSelectedStudentId((current) => nextRecord.students.some((student) => student.id === current)
            ? current
            : nextRecord.students[0]?.id || "");
        }
      }
      if (profile.role === "admin") {
        setSelectedStudentId(nextRecord.students[0]?.id || "");
        setActiveTab("admin");
      }
      if (profile.role === "student") setSelectedStudentId(profile.id);
      setSyncStatus("synced");
    } catch (error) {
      console.error(error);
      setSyncStatus("offline");
    }
  }

  useEffect(() => {
    if (demoUser) return undefined;
    let active = true;
    const unsubscribe = subscribeToYear4Auth((event) => {
      if (event === "PASSWORD_RECOVERY" && active) {
        setRecoveryMode(true);
        setAuthReady(true);
      }
    });
    getCurrentYear4Profile()
      .then(async (profile) => {
        if (!active || !profile) return;
        setUser(profile);
        await refreshRecord(profile);
      })
      .finally(() => { if (active) setAuthReady(true); });
    return () => { active = false; unsubscribe(); };
  }, []);

  async function login(credentials) {
    const profile = await signInYear4(credentials);
    setUser(profile);
    await refreshRecord(profile);
  }

  async function activate(credentials) {
    const result = await activateYear4Account(credentials);
    if (result.profile) {
      setUser(result.profile);
      await refreshRecord(result.profile);
    }
    return result.message;
  }

  async function logout() {
    if (!demoUser) await signOutYear4();
    setUser(null);
    setRecord(emptyRecord);
    setActiveTab("dashboard");
  }

  async function finishPasswordReset(password) {
    await updateYear4Password(password);
    await signOutYear4();
    window.history.replaceState({}, "", "/");
    setUser(null);
    setRecoveryMode(false);
    setAuthMessage("เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่");
  }

  async function changePassword(password) {
    await updateYear4Password(password);
    return "เปลี่ยนรหัสผ่านสำเร็จ";
  }

  async function sendPasswordReset(email = user?.email) {
    const message = await requestYear4PasswordReset(email);
    if (user) setAuthMessage(message);
    return message;
  }

  async function saveEntry(item, status) {
    setSyncStatus("saving");
    const selectedStaff = record.staff.find((person) => person.id === item.selectedApproverId);
    const saved = demoUser
      ? { ...item, id: crypto.randomUUID(), studentId: user.id, status, revision: 1, submittedAt: status === "submitted" ? new Date().toISOString() : null, selectedApproverName: selectedStaff?.name || "", supervisorName: selectedStaff?.name || "", oneDriveSyncStatus: "not_required" }
      : await createYear4Entry(user, item, status, record.staff);
    setRecord((current) => ({ ...current, entries: [saved, ...current.entries] }));
    setSyncStatus("synced");
    return saved;
  }

  async function editEntry(item, status) {
    setSyncStatus("saving");
    const saved = demoUser
      ? { ...item, status, revision: (item.revision || 1) + (item.status === "rejected" && status === "submitted" ? 1 : 0), approverComment: status === "submitted" ? "" : item.approverComment, submittedAt: status === "submitted" ? new Date().toISOString() : item.submittedAt }
      : await updateYear4Entry(user, item, status, record.staff);
    setRecord((current) => ({ ...current, entries: current.entries.map((entry) => entry.id === saved.id ? saved : entry) }));
    setSyncStatus("synced");
    return saved;
  }

  async function reviewEntry(entry, decision, comment) {
    setSyncStatus("saving");
    const saved = demoUser
      ? { ...entry, status: decision, approvedBy: decision === "approved" ? user.id : null, approvedAt: decision === "approved" ? new Date().toISOString() : null, approverName: decision === "approved" ? user.name : "", approverComment: comment, oneDriveSyncStatus: decision === "approved" ? "pending" : "not_required" }
      : await reviewYear4Entry(user, entry, decision, comment);
    setRecord((current) => ({ ...current, entries: current.entries.map((item) => item.id === saved.id ? saved : item) }));
    setSyncStatus("synced");
  }

  async function backupNow() {
    if (user?.role !== "admin") throw new Error("เฉพาะ Admin เท่านั้นที่สำรองข้อมูลได้");
    if (demoUser) return { fileName: "Year4_Logbook_Demo.xlsx", folderUrl: "" };
    return backupYear4ToGoogleDrive(user);
  }

  async function uploadStudentPhoto(file) {
    setSyncStatus("saving");
    try {
      const result = demoUser
        ? (() => { const url = URL.createObjectURL(file); return { avatarPath: url, url }; })()
        : await uploadYear4StudentPhoto(user, file);
      setUser((current) => ({ ...current, avatarPath: result.avatarPath }));
      setSyncStatus("synced");
      return result;
    } catch (error) {
      setSyncStatus("offline");
      throw error;
    }
  }

  async function deleteAdminData(filter, password) {
    setSyncStatus("saving");
    try {
      const result = demoUser
        ? { ok: true, deletedCount: record.entries.filter((entry) => {
            if (filter.scope === "student") return entry.studentId === filter.studentId;
            if (filter.scope === "group") return record.students.some((student) => student.id === entry.studentId && student.studentGroup === filter.studentGroup);
            return true;
          }).length }
        : await deleteYear4AdminData(user, filter, password);
      if (demoUser) {
        setRecord((current) => ({ ...current, entries: current.entries.filter((entry) => {
          if (filter.scope === "student") return entry.studentId !== filter.studentId;
          if (filter.scope === "group") return !current.students.some((student) => student.id === entry.studentId && student.studentGroup === filter.studentGroup);
          return false;
        }) }));
      } else {
        await refreshRecord(user);
      }
      setSyncStatus("synced");
      return result;
    } catch (error) {
      // A rejected admin operation (for example, an incorrect confirmation
      // password) does not mean the Supabase connection is offline.
      setSyncStatus("synced");
      throw error;
    }
  }

  async function deleteAdminAvatars(filter, password) {
    setSyncStatus("saving");
    try {
      const targetStudents = record.students.filter((student) => filter.scope === "student"
        ? student.id === filter.studentId
        : student.studentGroup === filter.studentGroup);
      const result = demoUser
        ? { ok: true, deletedCount: targetStudents.filter((student) => student.avatarPath).length, studentCount: targetStudents.length }
        : await deleteYear4AdminAvatars(user, filter, password);
      if (demoUser) {
        const targetIds = new Set(targetStudents.map((student) => student.id));
        setRecord((current) => ({ ...current, students: current.students.map((student) => targetIds.has(student.id) ? { ...student, avatarPath: "" } : student) }));
      } else {
        await refreshRecord(user);
      }
      setSyncStatus("synced");
      return result;
    } catch (error) {
      setSyncStatus("synced");
      throw error;
    }
  }

  async function saveRotation(rotation) {
    setSyncStatus("saving");
    try {
      const saved = demoUser ? { ...rotation, id: rotation.id || crypto.randomUUID() } : await saveYear4Rotation(user, rotation);
      setRecord((current) => ({ ...current, rotations: current.rotations.some((item) => item.id === saved.id) ? current.rotations.map((item) => item.id === saved.id ? saved : item) : [saved, ...current.rotations] }));
      setSyncStatus("synced");
      return saved;
    } catch (error) { setSyncStatus("synced"); throw error; }
  }

  async function submitCertification(staffEmail) {
    setSyncStatus("saving");
    try {
      const rotation = record.rotations.find((item) => item.academicYear === user.cohortYear && item.groupCode === user.studentGroup) || null;
      const existing = record.certifications.find((item) => item.studentId === user.id && item.academicYear === user.cohortYear);
      const saved = demoUser ? { id: existing?.id || crypto.randomUUID(), studentId: user.id, academicYear: user.cohortYear, rotationId: rotation?.id || "", selectedCertifierEmail: staffEmail, status: "submitted", submittedAt: new Date().toISOString(), certifiedAt: null, certifierNote: "" } : await submitYear4Certification(user, staffEmail, rotation?.id);
      setRecord((current) => ({ ...current, certifications: [saved, ...current.certifications.filter((item) => item.id !== saved.id)] }));
      setSyncStatus("synced"); return saved;
    } catch (error) { setSyncStatus("synced"); throw error; }
  }

  async function reviewCertification(certification, status, note) {
    setSyncStatus("saving");
    try {
      const saved = demoUser ? { ...certification, status, certifierNote: note, certifiedBy: status === "certified" ? user.id : null, certifiedAt: status === "certified" ? new Date().toISOString() : null } : await reviewYear4Certification(user, certification, status, note);
      setRecord((current) => ({ ...current, certifications: current.certifications.map((item) => item.id === saved.id ? saved : item) }));
      setSyncStatus("synced"); return saved;
    } catch (error) { setSyncStatus("synced"); throw error; }
  }

  async function deleteAdminEntry(entry, password) {
    setSyncStatus("saving");
    try {
      const result = demoUser ? { ok: true, deletedCount: 1 } : await deleteYear4AdminEntry(user, entry.id, entry.studentId, password);
      setRecord((current) => ({ ...current, entries: current.entries.filter((item) => item.id !== entry.id), approvalEvents: current.approvalEvents.filter((event) => event.entry_id !== entry.id) }));
      setSyncStatus("synced"); return result;
    } catch (error) { setSyncStatus("synced"); throw error; }
  }

  if (!authReady) return <div className="app-loading">กำลังเชื่อมต่อระบบ Surgery Logbook…</div>;
  if (recoveryMode) return <UpdatePasswordPage onUpdate={finishPasswordReset} />;
  if (!user) return <LoginPage onLogin={login} onActivate={activate} onRequestReset={sendPasswordReset} initialMessage={authMessage} />;

  const studentEntries = record.entries.filter((entry) => entry.studentId === user.id);
  const studentCertification = record.certifications.find((item) => item.studentId === user.id && item.academicYear === user.cohortYear);
  const content = user.role === "admin" ? {
    admin: <Year4Admin students={record.students} entries={record.entries} approvalEvents={record.approvalEvents} rotations={record.rotations} certifications={record.certifications} onDelete={deleteAdminData} onDeleteEntry={deleteAdminEntry} onDeleteAvatars={deleteAdminAvatars} onSaveRotation={saveRotation} onBackup={backupNow} />,
  }[activeTab] : user.role === "staff" ? {
    dashboard: <Year4Dashboard user={user} students={record.students} entries={record.entries} rotations={record.rotations} certifications={record.certifications} selectedStudentId={selectedStudentId} onSelectStudent={setSelectedStudentId} onNavigate={setActiveTab} />,
    review: <StaffReview currentStaff={user} students={record.students} entries={record.entries} certifications={record.certifications} selectedStudentId={selectedStudentId} onSelectStudent={setSelectedStudentId} onReview={reviewEntry} onReviewCertification={reviewCertification} />,
  }[activeTab] : {
    dashboard: <Year4Dashboard user={user} students={[user]} entries={record.entries} rotations={record.rotations} certifications={record.certifications} staff={record.staff} selectedStudentId={user.id} onSelectStudent={() => {}} onNavigate={setActiveTab} onPhotoUpload={uploadStudentPhoto} onSubmitCertification={submitCertification} />,
    logbook: <Year4Logbook entries={studentEntries} staff={record.staff} onSave={saveEntry} onUpdate={editEntry} onSubmitted={setQrPopupEntry} locked={studentCertification?.status === "certified"} />,
    qr: <StudentQr user={user} entries={record.entries} />,
  }[activeTab];

  return (
    <>
      <AppShell user={user} activeTab={activeTab} onTabChange={setActiveTab} onLogout={logout} onChangePassword={changePassword} syncStatus={syncStatus}>{content}</AppShell>
      {qrPopupEntry && <StudentQrModal user={user} entry={qrPopupEntry} onClose={() => setQrPopupEntry(null)} onOpenQr={() => { setQrPopupEntry(null); setActiveTab("qr"); }} />}
    </>
  );
}
