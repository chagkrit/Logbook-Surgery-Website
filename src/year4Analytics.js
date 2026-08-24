import { calculateProgress, year4Activities } from "./year4Data";

const HOUR = 60 * 60 * 1000;

export function progressSummary(entries) {
  const measurable = calculateProgress(entries).filter((item) => item.target !== null);
  const required = measurable.reduce((sum, item) => sum + item.target, 0);
  const completed = measurable.reduce((sum, item) => sum + Math.min(item.completed, item.target), 0);
  return { required, completed, percent: required ? Math.round((completed / required) * 100) : 0, minimum: Math.ceil(required * 0.8) };
}

export function findRotation(student, rotations, date = new Date().toISOString().slice(0, 10)) {
  return rotations.find((rotation) => rotation.academicYear === student.cohortYear
    && rotation.groupCode === student.studentGroup
    && date >= rotation.startDate && date <= rotation.endDate) || null;
}

export function detectYear4Anomalies(students, entries, rotations = []) {
  const today = new Date().toISOString().slice(0, 10);
  const studentMap = new Map(students.map((student) => [student.id, student]));
  const seen = new Map();
  const anomalies = [];
  entries.forEach((entry) => {
    const student = studentMap.get(entry.studentId);
    const activity = year4Activities.find((item) => item.id === entry.activityType);
    const duplicateKey = [entry.studentId, entry.activityType, entry.date, entry.patientReference || entry.weekNumber || entry.unitName || ""].join("|");
    if (seen.has(duplicateKey)) anomalies.push({ type: "duplicate", severity: "warning", entryId: entry.id, studentId: entry.studentId, message: "อาจเป็นรายการซ้ำในวันและกิจกรรมเดียวกัน" });
    else seen.set(duplicateKey, entry.id);
    if (entry.date > today) anomalies.push({ type: "future-date", severity: "danger", entryId: entry.id, studentId: entry.studentId, message: "วันที่ทำกิจกรรมอยู่ในอนาคต" });
    if (entry.approvedAt && entry.submittedAt && new Date(entry.approvedAt) < new Date(entry.submittedAt)) anomalies.push({ type: "timestamp", severity: "danger", entryId: entry.id, studentId: entry.studentId, message: "เวลาอนุมัติก่อนเวลาที่นักศึกษาส่ง" });
    if (activity?.fields.includes("patient") && !entry.patientReference) anomalies.push({ type: "missing", severity: "warning", entryId: entry.id, studentId: entry.studentId, message: "ขาดรหัสเคสแบบปกปิด" });
    const matchingRotation = student && rotations.find((rotation) => rotation.academicYear === (entry.academicYear || student.cohortYear) && rotation.groupCode === student.studentGroup);
    if (matchingRotation && (entry.date < matchingRotation.startDate || entry.date > matchingRotation.endDate)) anomalies.push({ type: "outside-rotation", severity: "warning", entryId: entry.id, studentId: entry.studentId, message: "วันที่กิจกรรมอยู่นอกช่วง rotation" });
  });
  return anomalies;
}

export function buildStudentMonitoring(students, entries, rotations = []) {
  const now = Date.now();
  return students.map((student) => {
    const studentEntries = entries.filter((entry) => entry.studentId === student.id && (!entry.academicYear || entry.academicYear === student.cohortYear));
    const progress = progressSummary(studentEntries);
    const stalePending = studentEntries.filter((entry) => entry.status === "submitted" && entry.submittedAt && now - new Date(entry.submittedAt).getTime() > 48 * HOUR).length;
    const rejected = studentEntries.filter((entry) => entry.status === "rejected").length;
    const pending = studentEntries.filter((entry) => entry.status === "submitted").length;
    const rotation = findRotation(student, rotations);
    const daysRemaining = rotation ? Math.ceil((new Date(`${rotation.endDate}T23:59:59`).getTime() - now) / (24 * HOUR)) : null;
    const atRisk = progress.percent < 80 && (daysRemaining === null || daysRemaining <= 14);
    return { ...student, ...progress, pending, stalePending, rejected, rotation, daysRemaining, atRisk };
  });
}

export function programQualitySummary(students, entries, rotations = []) {
  const monitoring = buildStudentMonitoring(students, entries, rotations);
  const approvedWithTimes = entries.filter((entry) => entry.status === "approved" && entry.submittedAt && entry.approvedAt);
  const averageApprovalHours = approvedWithTimes.length
    ? Math.round(approvedWithTimes.reduce((sum, entry) => sum + (new Date(entry.approvedAt) - new Date(entry.submittedAt)) / HOUR, 0) / approvedWithTimes.length * 10) / 10
    : 0;
  const anomalies = detectYear4Anomalies(students, entries, rotations);
  return {
    monitoring,
    anomalies,
    averageProgress: monitoring.length ? Math.round(monitoring.reduce((sum, item) => sum + item.percent, 0) / monitoring.length) : 0,
    atRiskCount: monitoring.filter((item) => item.atRisk).length,
    stalePendingCount: monitoring.reduce((sum, item) => sum + item.stalePending, 0),
    averageApprovalHours,
  };
}
