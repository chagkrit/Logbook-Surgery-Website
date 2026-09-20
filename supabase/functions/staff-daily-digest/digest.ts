export type DigestEntry = {
  id: string;
  student_id: string;
  enrollment_id: string;
  activity_type: string;
  activity_date: string;
  submitted_at: string;
  selected_approver_email: string;
};

export type DigestEnrollment = {
  id: string;
  curriculum_id: string;
  class_year: number;
};

export type DigestItem = {
  entryId: string;
  classYear: number;
  studentName: string;
  activity: string;
  date: string;
  waiting: string;
};

export function buildStaffDigests(
  entries: DigestEntry[],
  enrollments: Map<string, DigestEnrollment>,
  staff: Map<string, string>,
  studentNames: Map<string, string>,
  activityNames: Map<string, string>,
  now: number,
) {
  const byStaff = new Map<string, DigestItem[]>();
  for (const entry of entries) {
    const enrollment = enrollments.get(entry.enrollment_id);
    const submittedAt = new Date(entry.submitted_at).getTime();
    if (!enrollment || ![4, 5].includes(enrollment.class_year) || !staff.has(entry.selected_approver_email)
      || !Number.isFinite(submittedAt) || submittedAt > now - 48 * 3_600_000) continue;
    const items = byStaff.get(entry.selected_approver_email) || [];
    items.push({
      entryId: entry.id,
      classYear: enrollment.class_year,
      studentName: studentNames.get(entry.student_id) || "นักศึกษา",
      activity: activityNames.get(`${enrollment.curriculum_id}:${entry.activity_type}`) || entry.activity_type,
      date: new Date(submittedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", hour12: false }),
      waiting: `${Math.floor((now - submittedAt) / 3_600_000)} ชั่วโมง`,
    });
    byStaff.set(entry.selected_approver_email, items);
  }
  return byStaff;
}

function htmlEscape(value: unknown) {
  return String(value ?? "").replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] || character));
}

export function emailHtml(staffName: string, items: DigestItem[], appUrl: string) {
  const rows = items.map((item) => `<tr><td>Year ${item.classYear}</td><td>${htmlEscape(item.studentName)}</td><td>${htmlEscape(item.activity)}</td><td>${htmlEscape(item.date)}</td><td>${htmlEscape(item.waiting)}</td></tr>`).join("");
  return `<!doctype html><html lang="th"><body style="font-family:Arial,sans-serif;color:#202124;line-height:1.55">
    <h2 style="color:#155426">รายการ Logbook รออนุมัติ</h2>
    <p>เรียน ${htmlEscape(staffName)},</p>
    <p>มี ${items.length} รายการของ Year 4/5 ที่นักศึกษาระบุท่านเป็นผู้อนุมัติ และค้างเกิน 48 ชั่วโมง</p>
    <table style="border-collapse:collapse;width:100%"><thead><tr><th align="left">ชั้นปี</th><th align="left">นักศึกษา</th><th align="left">กิจกรรม</th><th align="left">วันที่ส่ง</th><th align="left">ระยะเวลาค้าง</th></tr></thead><tbody>${rows}</tbody></table>
    <p style="margin-top:20px"><a href="${appUrl}" style="display:inline-block;padding:10px 14px;background:#155426;color:#fff;text-decoration:none;border-radius:6px">เข้าสู่ระบบเพื่อตรวจและอนุมัติ</a></p>
    <p style="font-size:12px;color:#6b7280">อีเมลนี้ไม่แสดง HN, diagnosis หรือรายละเอียดผู้ป่วย</p>
  </body></html>`;
}
