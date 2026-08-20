import React from "react";
import { QRCodeSVG } from "qrcode.react";
import { QrIcon, ShieldIcon } from "../components/Icons";

export default function StudentQr({ user, entries }) {
  const qrValue = `${window.location.origin}/evaluate/${user.qrToken}`;
  const pending = entries.filter((entry) => entry.studentId === user.id && entry.status === "submitted").length;

  return (
    <>
      <div className="page-heading"><div><h1>QR ประจำตัวนักศึกษา</h1><p>แสดง QR นี้ให้ Staff หลังจากส่งกิจกรรมเพื่อรออนุมัติ</p></div></div>
      <div className="qr-layout">
        <section className="content-panel qr-card">
          <div className="qr-brand"><img src="/surgery-cmu-logo.png" alt="Surgery CMU" /><div><strong>Surgery Logbook · Year 4</strong><span>คณะแพทยศาสตร์ มหาวิทยาลัยเชียงใหม่</span></div></div>
          <div className="qr-code-wrap"><QRCodeSVG value={qrValue} size={248} level="H" marginSize={2} bgColor="#ffffff" fgColor="#111827" /></div>
          <h2>{user.name}</h2>
          <p>{user.studentCode} · ปีการศึกษา {user.cohortYear || 2568}</p>
          <code>{String(user.qrToken).slice(0, 8).toUpperCase()}</code>
          <div className="qr-pending"><QrIcon size={18} /> มี {pending} รายการรอ Staff อนุมัติ</div>
          <button className="secondary-button" onClick={() => window.print()}>พิมพ์บัตร QR</button>
        </section>
        <aside className="content-panel qr-guidance">
          <ShieldIcon size={34} />
          <h2>QR นี้ใช้ระบุตัวนักศึกษาเท่านั้น</h2>
          <p>การสแกน QR จะไม่อนุมัติรายการโดยอัตโนมัติ Staff ต้องเข้าสู่ระบบ ตรวจชื่อและเลือกรายการที่ต้องการประเมินทุกครั้ง</p>
          <ol><li>บันทึกกิจกรรมและกดส่งให้ Staff</li><li>เปิดหน้า QR ประจำตัว</li><li>ให้ Staff สแกนและตรวจข้อมูล</li><li>ติดตามผลที่หน้า Logbook</li></ol>
          <div className="privacy-note">QR ไม่มีชื่อผู้ป่วย HN หรือข้อมูลทางการแพทย์ฝังอยู่ภายใน</div>
        </aside>
      </div>
    </>
  );
}
