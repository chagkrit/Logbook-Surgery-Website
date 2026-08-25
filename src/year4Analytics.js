import { calculateProgress, year4Activities } from "./year4Data";

const HOUR = 60 * 60 * 1000;

export function progressSummary(entries, activities = year4Activities, passPercent = 80) {
  const measurable = calculateProgress(entries, activities).filter((item) => item.target !== null);
  const required = measurable.reduce((sum, item) => sum + item.target, 0);
  const completed = measurable.reduce((sum, item) => sum + Math.min(item.completed, item.target), 0);
  return { required, completed, percent: required ? Math.round((completed / required) * 100) : 0, minimum: Math.ceil(required * passPercent / 100), passPercent };
}

export function findRotation(student, rotations, date = new Date().toISOString().slice(0, 10)) {
  return rotations.find((rotation) => (!student.activeEnrollment || rotation.curriculumId === student.activeEnrollment.curriculumId)
    && rotation.groupCode === student.studentGroup
    && date >= rotation.startDate && date <= rotation.endDate) || null;
}

export function detectYear4Anomalies(students, entries, rotations = [], activities = year4Activities) {
  const today = new Date().toISOString().slice(0, 10);
  const studentMap = new Map(students.map((student) => [student.id, student]));
  const seen = new Map();
  const anomalies = [];
  entries.forEach((entry) => {
    const student = studentMap.get(entry.studentId);
    const activity = activities.find((item) => item.id === entry.activityType && (!entry.curriculumId || item.curriculumId === entry.curriculumId));
    const duplicateKey = [entry.studentId, entry.activityType, entry.date, entry.patientReference || entry.weekNumber || entry.unitName || ""].join("|");
    if (seen.has(duplicateKey)) anomalies.push({ type: "duplicate", severity: "warning", entryId: entry.id, studentId: entry.studentId, message: "อาจเป็นรายการซ้ำในวันและกิจกรรมเดียวกัน" });
    else seen.set(duplicateKey, entry.id);
    if (entry.date > today) anomalies.push({ type: "future-date", severity: "danger", entryId: entry.id, studentId: entry.studentId, message: "วันที่ทำกิจกรรมอยู่ในอนาคต" });
    if (entry.approvedAt && entry.submittedAt && new Date(entry.approvedAt) < new Date(entry.submittedAt)) anomalies.push({ type: "timestamp", severity: "danger", entryId: entry.id, studentId: entry.studentId, message: "เวลาอนุมัติก่อนเวลาที่นักศึกษาส่ง" });
    if (activity?.fields.includes("patient") && !entry.patientReference) anomalies.push({ type: "missing", severity: "warning", entryId: entry.id, studentId: entry.studentId, message: "ขาดรหัสเคสแบบปกปิด" });
    const matchingRotation = student && rotations.find((rotation) => (!entry.curriculumId || rotation.curriculumId === entry.curriculumId) && rotation.groupCode === student.studentGroup);
    if (matchingRotation && (entry.date < matchingRotation.startDate || entry.date > matchingRotation.endDate)) anomalies.push({ type: "outside-rotation", severity: "warning", entryId: entry.id, studentId: entry.studentId, message: "วันที่กิจกรรมอยู่นอกช่วง rotation" });
  });
  return anomalies;
}

export function buildStudentMonitoring(students, entries, rotations = [], activities = year4Activities) {
  const now = Date.now();
  return students.map((student) => {
    const studentEntries = entries.filter((entry) => entry.studentId === student.id && (!student.activeEnrollment || entry.enrollmentId === student.activeEnrollment.id));
    const studentActivities = activities.filter((activity) => !student.activeEnrollment || activity.curriculumId === student.activeEnrollment.curriculumId);
    const progress = progressSummary(studentEntries, studentActivities.length ? studentActivities : activities, student.activeEnrollment?.passPercent || 80);
    const stalePending = studentEntries.filter((entry) => entry.status === "submitted" && entry.submittedAt && now - new Date(entry.submittedAt).getTime() > 48 * HOUR).length;
    const rejected = studentEntries.filter((entry) => entry.status === "rejected").length;
    const pending = studentEntries.filter((entry) => entry.status === "submitted").length;
    const rotation = findRotation(student, rotations);
    const daysRemaining = rotation ? Math.ceil((new Date(`${rotation.endDate}T23:59:59`).getTime() - now) / (24 * HOUR)) : null;
    const atRisk = progress.percent < progress.passPercent && (daysRemaining === null || daysRemaining <= 14);
    return { ...student, ...progress, pending, stalePending, rejected, rotation, daysRemaining, atRisk };
  });
}

export function programQualitySummary(students, entries, rotations = [], activities = year4Activities) {
  const monitoring = buildStudentMonitoring(students, entries, rotations, activities);
  const approvedWithTimes = entries.filter((entry) => entry.status === "approved" && entry.submittedAt && entry.approvedAt);
  const averageApprovalHours = approvedWithTimes.length
    ? Math.round(approvedWithTimes.reduce((sum, entry) => sum + (new Date(entry.approvedAt) - new Date(entry.submittedAt)) / HOUR, 0) / approvedWithTimes.length * 10) / 10
    : 0;
  const anomalies = detectYear4Anomalies(students, entries, rotations, activities);
  return {
    monitoring,
    anomalies,
    averageProgress: monitoring.length ? Math.round(monitoring.reduce((sum, item) => sum + item.percent, 0) / monitoring.length) : 0,
    atRiskCount: monitoring.filter((item) => item.atRisk).length,
    stalePendingCount: monitoring.reduce((sum, item) => sum + item.stalePending, 0),
    averageApprovalHours,
  };
}
