const sortText = (a, b) => String(a || "").localeCompare(String(b || ""), "th", { numeric: true });

export function buildPromotionCandidates(students, sourceCurriculumId, certifications) {
  return students.filter((student) => student.activeEnrollment?.curriculumId === sourceCurriculumId).map((student) => ({
    ...student,
    enrollment: student.activeEnrollment,
    certified: certifications.some((item) => item.enrollmentId === student.activeEnrollment.id && item.status === "certified"),
  })).sort((a, b) => sortText(a.studentCode || a.name, b.studentCode || b.name));
}

export function validatePromotionQueue(queue, destinationCurriculumId, rotations, enrollments) {
  const counts = new Map();
  queue.forEach((item) => counts.set(item.studentId, (counts.get(item.studentId) || 0) + 1));
  const rotationMap = new Map(rotations.map((item) => [item.id, item]));
  const issues = queue.map((item) => {
    const rotation = rotationMap.get(item.destinationRotationId);
    return {
      ...item,
      duplicate: counts.get(item.studentId) > 1,
      missingAssignment: !item.destinationGroup || !item.destinationRotationId,
      rotationMismatch: Boolean(item.destinationRotationId && (!rotation || rotation.curriculumId !== destinationCurriculumId || rotation.groupCode !== item.destinationGroup)),
      uncertified: !item.certified && !(item.override && item.overrideReason.trim()),
      alreadyDestination: enrollments.some((enrollment) => enrollment.studentId === item.studentId && enrollment.curriculumId === destinationCurriculumId && enrollment.status === "active"),
    };
  });
  return {
    rows: issues,
    total: issues.length,
    ready: issues.filter((item) => !item.duplicate && !item.missingAssignment && !item.rotationMismatch && !item.uncertified && !item.alreadyDestination).length,
    uncertified: issues.filter((item) => item.uncertified).length,
    missing: issues.filter((item) => item.missingAssignment || item.rotationMismatch).length,
    duplicates: issues.filter((item) => item.duplicate).length,
    alreadyDestination: issues.filter((item) => item.alreadyDestination).length,
  };
}
