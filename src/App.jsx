import React, { useEffect, useState } from "react";
import AppShell from "./components/AppShell";
import LoginPage from "./features/LoginPage";
import PublicLegalPage from "./features/PublicLegalPage";
import StaffReview from "./features/StaffReview";
import StudentQr from "./features/StudentQr";
import StudentQrModal from "./features/StudentQrModal";
import UpdatePasswordPage from "./features/UpdatePasswordPage";
import Year4Dashboard from "./features/Year4Dashboard";
import Year4Admin from "./features/Year4Admin";
import Year4Logbook from "./features/Year4Logbook";
import { demoAdmin, demoStaff, demoStaffDirectory, demoStudents } from "./year4Data";
import {
  activateYear4Account,
  backupYear4ToGoogleDrive,
  createYear4Entry,
  deleteYear4AdminAvatars,
  deleteYear4AdminData,
  deleteYear4AdminEntry,
  deleteYear4Students,
  getCurrentYear4Profile,
  loadYear4Record,
  requestYear4PasswordReset,
  replaceCurriculumActivities,
  reviewYear4Certification,
  reviewYear4Entry,
  saveYear4Rotation,
  saveCurriculum,
  signInYear4,
  signOutYear4,
  subscribeToYear4Auth,
  submitYear4Certification,
  publishCurriculum,
  updateYear4Entry,
  updateYear4Password,
  upsertYear4Student,
  upsertYear4Staff,
  uploadYear4StudentPhoto,
} from "./year4Api";

const demoParams = new URLSearchParams(window.location.search);
const demoRole = import.meta.env.DEV ? demoParams.get("demo") : null;
const demoYear5Curriculum = { id: "demo-curriculum-y5", code: "surgery-y5-2569", classYear: 5, academicYear: 2569, name: "Surgery Logbook Year 5 · พ.ศศ.501", passPercent: 80, status: "published", sourceFilename: "ปี 5เล่มเล็ก-2569.doc", version: 1 };
const demoStudentCurriculum = demoYear5Curriculum;
const demoEnrollments = demoStudents.map((student) => ({ id: `enrollment-${student.id}-${demoStudentCurriculum.classYear}`, studentId: student.id, curriculumId: demoStudentCurriculum.id, classYear: demoStudentCurriculum.classYear, academicYear: demoStudentCurriculum.academicYear, curriculumName: demoStudentCurriculum.name, passPercent: 80, groupCode: student.studentGroup, status: "active" }));
const demoStudentsWithEnrollment = demoStudents.map((student) => ({ ...student, cohortYear: demoStudentCurriculum.academicYear, classYear: demoStudentCurriculum.classYear, academicYear: demoStudentCurriculum.academicYear, activeEnrollment: demoEnrollments.find((item) => item.studentId === student.id) }));
const rawDemoUser = demoRole === "admin" ? demoAdmin : demoRole === "staff" ? demoStaff : demoRole === "student" ? demoStudentsWithEnrollment[0] : null;
const demoUser = rawDemoUser;
const demoYear5Fields = {
  "ipd-patient-care": ["week", "patient", "diagnosis", "unit", "detail"], "opd-attendance": ["week", "unit", "detail"],
  "opd-examined-case": ["patient", "unit", "detail"], "major-operation-observe": ["week", "patient", "diagnosis", "procedure", "detail"],
  "major-operation-assist": ["patient", "diagnosis", "procedure", "detail"], "minor-operation": ["patient", "diagnosis", "procedure", "detail"],
  "major-trauma-first-aid": ["patient", "diagnosis", "procedure", "detail"], "wound-suture": ["patient", "diagnosis", "unit", "detail"],
  "foley-catheter": ["patient", "diagnosis", "unit", "detail"], "cvp-measurement": ["patient", "diagnosis", "unit", "detail"],
  "er-duty": ["detail"], "resident-teaching": ["week", "title", "detail"],
};
const demoYear5Activities = [
  ["ipd-patient-care", "ผู้ป่วยที่ได้รับไว้ในความดูแลแบบ IPD หน่วยละ 2 ราย", "การดูแลผู้ป่วย", 12, "ราย"],
  ["opd-attendance", "การเข้าเรียนที่ OPD", "ผู้ป่วยนอก", 6, "ครั้ง"],
  ["opd-examined-case", "เคสที่ได้ตรวจเองที่ OPD ในสาย", "ผู้ป่วยนอก", 10, "ราย"],
  ["major-operation-observe", "สังเกตการผ่าตัดใหญ่", "การผ่าตัด", 6, "ราย"],
  ["major-operation-assist", "ช่วยการผ่าตัดใหญ่", "การผ่าตัด", 1, "ราย"],
  ["minor-operation", "สังเกตหรือช่วยการผ่าตัดเล็ก", "การผ่าตัด", 2, "ราย"],
  ["major-trauma-first-aid", "First aid in major trauma", "หัตถการ", 2, "ราย"],
  ["wound-suture", "เย็บแผล", "หัตถการ", 2, "ราย"],
  ["foley-catheter", "ใส่ Foley catheter", "หัตถการ", 2, "ราย"],
  ["cvp-measurement", "วัด Central venous pressure (CVP)", "หัตถการ", 1, "ราย"],
  ["er-duty", "อยู่เวรห้องฉุกเฉิน", "เวรและกิจกรรมหน่วย", 3, "ครั้ง"],
  ["resident-teaching", "การสอนของแพทย์ประจำบ้าน", "เวรและกิจกรรมหน่วย", 6, "ครั้ง"],
].map(([id, title, group, target, unit], index) => ({ id, title, group, target, unit, sortOrder: index + 1, curriculumId: demoYear5Curriculum.id, classYear: 5, fields: demoYear5Fields[id] || ["detail"] }));
const demoYear5Entries = [
  { id: "demo-y5-pending", studentId: "demo-student-1", enrollmentId: "enrollment-demo-student-1-5", curriculumId: demoYear5Curriculum.id, activityType: "opd-attendance", date: "2026-08-25", detail: "เข้าเรียนและอภิปรายเคส", status: "submitted", selectedApproverId: demoStaff.id, selectedApproverName: demoStaff.name, submittedAt: "2026-08-25T02:00:00Z" },
  { id: "demo-y5-approved", studentId: "demo-student-2", enrollmentId: "enrollment-demo-student-2-5", curriculumId: demoYear5Curriculum.id, activityType: "major-operation-assist", date: "2026-08-24", detail: "ช่วยผ่าตัดภายใต้การกำกับ", status: "approved", selectedApproverId: demoStaff.id, selectedApproverName: demoStaff.name, submittedAt: "2026-08-24T02:00:00Z", approvedAt: "2026-08-24T03:00:00Z", approvedBy: demoStaff.id, approverName: demoStaff.name },
];
const emptyRecord = { students: [], staff: [], entries: [], approvalEvents: [], rotations: [], certifications: [], curricula: [], activities: [], enrollments: [] };
const evaluationToken = window.location.pathname.startsWith("/evaluate/")
  ? decodeURIComponent(window.location.pathname.split("/").filter(Boolean).pop() || "")
  : "";
const demoEvaluationStudent = demoUser?.role === "staff" && evaluationToken
  ? demoStudentsWithEnrollment.find((student) => student.qrToken.toLocaleLowerCase() === evaluationToken.toLocaleLowerCase())
  : null;

function LogbookApp() {
  const [user, setUser] = useState(demoUser);
  const [record, setRecord] = useState(demoUser ? { students: demoStudentsWithEnrollment, staff: demoStaffDirectory.map((person) => ({ ...person, curriculumAssignments: [{ curriculumId: demoYear5Curriculum.id, unitName: "Surgery" }] })), entries: demoYear5Entries, approvalEvents: [], rotations: [], certifications: [], curricula: [demoYear5Curriculum], activities: demoYear5Activities, enrollments: demoEnrollments } : emptyRecord);
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
      if (profile.role === "student") {
        const enrichedProfile = nextRecord.students.find((student) => student.id === profile.id);
        if (enrichedProfile) setUser(enrichedProfile);
      }
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
        if (!profile.active) {
          await signOutYear4();
          setAuthMessage("บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อ Admin");
          return;
        }
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
      ? { ...item, id: crypto.randomUUID(), studentId: user.id, enrollmentId: user.activeEnrollment?.id || "", curriculumId: user.activeEnrollment?.curriculumId || "", classYear: user.classYear || 4, academicYear: user.academicYear || user.cohortYear, status, revision: 1, submittedAt: status === "submitted" ? new Date().toISOString() : null, selectedApproverName: selectedStaff?.name || "", supervisorName: selectedStaff?.name || "", oneDriveSyncStatus: "not_required" }
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
    if (demoUser) return { fileName: "Surgery_Logbook_MultiYear_Demo.xlsx", folderUrl: "" };
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
      const rawSaved = demoUser ? { ...rotation, id: rotation.id || crypto.randomUUID() } : await saveYear4Rotation(user, rotation);
      const curriculum = record.curricula.find((item) => item.id === rawSaved.curriculumId);
      const saved = { ...rawSaved, classYear: curriculum?.classYear, academicYear: curriculum?.academicYear };
      setRecord((current) => ({ ...current, rotations: current.rotations.some((item) => item.id === saved.id) ? current.rotations.map((item) => item.id === saved.id ? saved : item) : [saved, ...current.rotations] }));
      setSyncStatus("synced");
      return saved;
    } catch (error) { setSyncStatus("synced"); throw error; }
  }

  async function submitCertification(staffEmail) {
    setSyncStatus("saving");
    try {
      const rotation = record.rotations.find((item) => item.curriculumId === user.activeEnrollment?.curriculumId && item.groupCode === user.studentGroup) || null;
      const existing = record.certifications.find((item) => item.enrollmentId === user.activeEnrollment?.id);
      const saved = demoUser ? { id: existing?.id || crypto.randomUUID(), studentId: user.id, enrollmentId: user.activeEnrollment?.id, academicYear: user.academicYear, rotationId: rotation?.id || "", selectedCertifierEmail: staffEmail, status: "submitted", submittedAt: new Date().toISOString(), certifiedAt: null, certifierNote: "" } : await submitYear4Certification(user, staffEmail, rotation?.id);
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

  async function saveAdminStaff(staff, password) {
    setSyncStatus("saving");
    try {
      const result = demoUser
        ? { ok: true, staff: { email: staff.email, name: `${staff.firstName} ${staff.lastName}`, assignments: staff.assignments }, activationUrl: `${window.location.origin}/?register=staff` }
        : await upsertYear4Staff(user, staff, password);
      if (!demoUser) await refreshRecord(user);
      else setRecord((current) => ({ ...current, staff: [...current.staff.filter((item) => item.email !== staff.email), { id: staff.email, email: staff.email, name: result.staff.name, role: "staff", curriculumAssignments: staff.assignments.map((item) => ({ curriculumId: item.curriculumId, unitName: item.unitName })) }] }));
      setSyncStatus("synced"); return result;
    } catch (error) { setSyncStatus("synced"); throw error; }
  }

  async function saveAdminStudent(student, password) {
    setSyncStatus("saving");
    try {
      const curriculum = record.curricula.find((item) => item.id === student.curriculumId);
      const existing = record.students.find((item) => item.id === student.id);
      const result = demoUser
        ? {
            ok: true,
            created: !existing,
            setupEmailSent: !existing,
            student: {
              id: existing?.id || crypto.randomUUID(),
              name: `${student.firstName} ${student.lastName}`.replace(/\s+/g, " ").trim(),
              email: student.email,
              role: "student",
              active: true,
              studentCode: student.studentCode,
              studentGroup: student.studentGroup,
            },
          }
        : await upsertYear4Student(user, student, password);
      if (!demoUser) await refreshRecord(user);
      else {
        const savedStudent = {
          ...result.student,
          classYear: curriculum?.classYear,
          academicYear: curriculum?.academicYear,
          cohortYear: curriculum?.academicYear,
        };
        const enrollment = {
          id: existing?.activeEnrollment?.id || crypto.randomUUID(),
          studentId: savedStudent.id,
          curriculumId: student.curriculumId,
          classYear: curriculum?.classYear,
          academicYear: curriculum?.academicYear,
          curriculumName: curriculum?.name || "",
          passPercent: curriculum?.passPercent || 80,
          groupCode: student.studentGroup,
          status: "active",
        };
        savedStudent.activeEnrollment = enrollment;
        setRecord((current) => ({
          ...current,
          students: current.students.some((item) => item.id === savedStudent.id)
            ? current.students.map((item) => item.id === savedStudent.id ? savedStudent : item)
            : [savedStudent, ...current.students],
          enrollments: [enrollment, ...current.enrollments.filter((item) => item.id !== enrollment.id && item.studentId !== savedStudent.id)],
        }));
      }
      setSyncStatus("synced"); return result;
    } catch (error) { setSyncStatus("synced"); throw error; }
  }

  async function deleteAdminStudents(studentIds, password) {
    setSyncStatus("saving");
    try {
      const result = demoUser
        ? { ok: true, deletedCount: studentIds.length, deletedAvatarCount: record.students.filter((student) => studentIds.includes(student.id) && student.avatarPath).length }
        : await deleteYear4Students(user, studentIds, password);
      if (!demoUser) await refreshRecord(user);
      else {
        const removed = new Set(studentIds);
        setRecord((current) => ({
          ...current,
          students: current.students.filter((student) => !removed.has(student.id)),
          entries: current.entries.filter((entry) => !removed.has(entry.studentId)),
          enrollments: current.enrollments.filter((item) => !removed.has(item.studentId)),
          certifications: current.certifications.filter((item) => !removed.has(item.studentId)),
        }));
      }
      setSyncStatus("synced"); return result;
    } catch (error) { setSyncStatus("synced"); throw error; }
  }

  async function saveAdminCurriculum(curriculum) {
    const saved = demoUser ? { ...curriculum, id: crypto.randomUUID(), status: "draft" } : await saveCurriculum(user, curriculum);
    setRecord((current) => ({ ...current, curricula: [saved, ...current.curricula.filter((item) => item.id !== saved.id)] }));
    return saved;
  }

  async function importAdminActivities(curriculumId, activities, sourceFilename) {
    if (!demoUser) {
      await replaceCurriculumActivities(user, curriculumId, activities);
      const curriculum = record.curricula.find((item) => item.id === curriculumId);
      if (curriculum && sourceFilename) await saveCurriculum(user, { ...curriculum, sourceFilename });
      await refreshRecord(user);
    } else setRecord((current) => ({ ...current, activities: [...current.activities.filter((item) => item.curriculumId !== curriculumId), ...activities.map((item) => ({ ...item, curriculumId }))] }));
  }

  async function publishAdminCurriculum(curriculumId) {
    const saved = demoUser ? { ...record.curricula.find((item) => item.id === curriculumId), status: "published" } : await publishCurriculum(user, curriculumId);
    setRecord((current) => ({ ...current, curricula: current.curricula.map((item) => item.id === saved.id ? saved : item) }));
    return saved;
  }

  if (!authReady) return <div className="app-loading">กำลังเชื่อมต่อระบบ Surgery Logbook…</div>;
  if (recoveryMode) return <UpdatePasswordPage onUpdate={finishPasswordReset} />;
  if (!user) return <LoginPage onLogin={login} onActivate={activate} onRequestReset={sendPasswordReset} initialMessage={authMessage} />;

  const activeEnrollment = user.activeEnrollment;
  const currentActivities = record.activities.filter((item) => !activeEnrollment || item.curriculumId === activeEnrollment.curriculumId);
  const currentStaff = record.staff.filter((item) => !activeEnrollment || item.curriculumAssignments?.some((assignment) => assignment.curriculumId === activeEnrollment.curriculumId));
  const studentEntries = record.entries.filter((entry) => entry.studentId === user.id && (!activeEnrollment || entry.enrollmentId === activeEnrollment.id));
  const studentCertification = record.certifications.find((item) => item.enrollmentId === activeEnrollment?.id);
  const content = user.role === "admin" ? {
    admin: <Year4Admin students={record.students} staff={record.staff} entries={record.entries} approvalEvents={record.approvalEvents} rotations={record.rotations} certifications={record.certifications} curricula={record.curricula} activities={record.activities} enrollments={record.enrollments} onDelete={deleteAdminData} onDeleteEntry={deleteAdminEntry} onDeleteAvatars={deleteAdminAvatars} onDeleteStudents={deleteAdminStudents} onSaveStudent={saveAdminStudent} onSaveStaff={saveAdminStaff} onSaveRotation={saveRotation} onSaveCurriculum={saveAdminCurriculum} onImportActivities={importAdminActivities} onPublishCurriculum={publishAdminCurriculum} onBackup={backupNow} />,
  }[activeTab] : user.role === "staff" ? {
    dashboard: <Year4Dashboard user={user} students={record.students} entries={record.entries} activities={record.activities} rotations={record.rotations} certifications={record.certifications} selectedStudentId={selectedStudentId} onSelectStudent={setSelectedStudentId} onNavigate={setActiveTab} />,
    review: <StaffReview currentStaff={user} students={record.students} entries={record.entries} activities={record.activities} certifications={record.certifications} selectedStudentId={selectedStudentId} onSelectStudent={setSelectedStudentId} onReview={reviewEntry} onReviewCertification={reviewCertification} />,
  }[activeTab] : {
    dashboard: <Year4Dashboard user={user} students={[user]} entries={record.entries} activities={currentActivities} rotations={record.rotations} certifications={record.certifications} staff={currentStaff} selectedStudentId={user.id} onSelectStudent={() => {}} onNavigate={setActiveTab} onPhotoUpload={uploadStudentPhoto} onSubmitCertification={submitCertification} />,
    logbook: <Year4Logbook entries={studentEntries} activities={currentActivities} staff={currentStaff} onSave={saveEntry} onUpdate={editEntry} onSubmitted={setQrPopupEntry} locked={studentCertification?.status === "certified"} />,
    qr: <StudentQr user={user} entries={record.entries} />,
  }[activeTab];

  return (
    <>
      <AppShell user={user} activeTab={activeTab} onTabChange={setActiveTab} onLogout={logout} onChangePassword={changePassword} syncStatus={syncStatus}>{content}</AppShell>
      {qrPopupEntry && <StudentQrModal user={user} entry={qrPopupEntry} onClose={() => setQrPopupEntry(null)} onOpenQr={() => { setQrPopupEntry(null); setActiveTab("qr"); }} />}
    </>
  );
}

export default function App() {
  const legalType = window.location.pathname === "/privacy"
    ? "privacy"
    : window.location.pathname === "/terms"
      ? "terms"
      : "";
  return legalType ? <PublicLegalPage type={legalType} /> : <LogbookApp />;
}
