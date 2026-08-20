# Surgery Logbook · Year 4

เว็บบันทึก Logbook นักศึกษาแพทย์ชั้นปีที่ 4 ตาม `Logbook-year4-2568.pdf` แยกสิทธิ์ Student/Staff รองรับอีเมลยืนยันตัวตน การรีเซ็ตรหัสผ่าน QR ประจำตัว การตรวจอนุมัติพร้อม audit trail และการสำรอง Excel ไปยัง Microsoft OneDrive ของภาควิชา

## Architecture

- Frontend: React + Vite แบบ responsive สำหรับ desktop, tablet และ mobile
- Authentication: Supabase Auth (email verification และ password-reset link)
- Primary database: Supabase PostgreSQL พร้อม Row Level Security
- Approval: Student ส่งรายการ แล้ว Staff ตรวจชื่อ/QR ก่อน approve หรือส่งกลับแก้ไข
- Backup: Vercel serverless function สร้าง Excel และอัปโหลดไป OneDrive ผ่าน Microsoft Graph

OneDrive ไม่ได้ใช้แทนฐานข้อมูลหลัก เพราะไม่เหมาะกับ transaction, concurrent editing, RLS และ audit log แต่พื้นที่ 5 TB ใช้เป็นปลายทางสำรองไฟล์ได้

## Run locally

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

เปิด `http://127.0.0.1:5173/`

โหมด demo ใช้ข้อมูลสังเคราะห์และไม่เขียนข้อมูลจริง:

- Student: `http://127.0.0.1:5173/?demo=student`
- Staff: `http://127.0.0.1:5173/?demo=staff`

## Environment variables

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key

# server-only: ห้ามใช้ VITE_ prefix และห้ามส่งไป browser
MICROSOFT_TENANT_ID=your-tenant-id
MICROSOFT_CLIENT_ID=your-application-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret
# ใช้เมื่อต่อบัญชี Microsoft personal/delegated
MICROSOFT_REFRESH_TOKEN=optional-delegated-refresh-token
# ใช้เฉพาะโหมด application-only ของ Microsoft 365
ONEDRIVE_ACCOUNT_ID=department-account@your-domain.ac.th
```

Publishable key ใช้ฝั่ง browser ได้ เพราะสิทธิ์ข้อมูลจริงถูกบังคับด้วย RLS ห้ามใส่ Supabase `service_role` key หรือ Microsoft client secret ใน frontend

## Database setup

Migration หลักอยู่ที่ `supabase/migrations/20260820101903_year4_logbook.sql` และประกอบด้วย:

- Student/Staff profiles และ QR token แบบสุ่ม
- รายการกิจกรรม 17 หมวดและเป้าหมายจาก Logbook ปี 4
- สถานะ `draft`, `submitted`, `approved`, `rejected`
- ประวัติ approval/rejection แบบ append-only
- RLS ที่จำกัด Student ให้เห็นและแก้ไขเฉพาะข้อมูลของตนเอง

นำ migration ไปใช้กับโครงการ Supabase ที่เลือก หลังจากตรวจ project reference ให้ถูกต้องแล้วจึงสร้างบัญชี Staff ผ่านกระบวนการผู้ดูแลระบบ

## Authentication setup

ใน Supabase Auth:

1. เปิด Email provider และเปิด Confirm email
2. ตั้ง Site URL เป็น production URL
3. เพิ่ม Redirect URL เช่น `https://your-domain/reset-password`
4. สำหรับ local development เพิ่ม `http://127.0.0.1:5173/reset-password`
5. ปรับ email templates ให้ระบุชื่อระบบและช่องทางติดต่อภาควิชา

Student สมัครได้เองด้วยชื่อ–นามสกุล รหัสนักศึกษา อีเมล และรหัสผ่าน โดยต้องยืนยันอีเมลก่อนเข้าสู่ระบบ ไม่ต้องเพิ่มอีเมลใน allowlist ล่วงหน้า ส่วนสิทธิ์ Staff ต้องกำหนดอีเมลโดยผู้ดูแลในฐานข้อมูล การเลือกปุ่ม Staff ในหน้าเว็บไม่สามารถยกระดับสิทธิ์ได้

## OneDrive setup

ตัวเชื่อมรองรับ 2 รูปแบบ:

- Microsoft 365 work/school account: application-only พร้อม admin consent และ `ONEDRIVE_ACCOUNT_ID`
- Microsoft personal account: delegated OAuth พร้อม `MICROSOFT_REFRESH_TOKEN` และเรียก `/me/drive`

ขั้นตอนตั้งค่า:

1. สร้าง App registration ใน Microsoft Entra
2. ให้สิทธิ์ Microsoft Graph ที่จำเป็น โดยเลือกขอบเขตแคบที่สุดตามชนิดบัญชี
3. สร้าง client secret และตั้งค่าเฉพาะใน Vercel server environment
4. ถ้าเป็น personal account ให้ทำ delegated consent เพื่อรับ refresh token; ถ้าเป็น Microsoft 365 app-only ให้ตั้ง `ONEDRIVE_ACCOUNT_ID`
5. Staff กด `สำรองไป OneDrive` เพื่อสร้างไฟล์ `Logbook-Year4-*.xlsx`

ไฟล์ประกอบด้วย worksheets สำหรับ Logbook, Approval Audit และ Manifest ระบบตรวจ Supabase JWT และ role=staff ที่ server ก่อนสร้างไฟล์ทุกครั้ง

> Refresh token เป็น secret สำคัญ ต้องเก็บเฉพาะฝั่ง server และควรมีวิธีเชื่อมบัญชีใหม่เมื่อ token ถูกเพิกถอนหรือหมดอายุ การใช้งานจริงควรยืนยันก่อนว่าบัญชีภาควิชาเป็น Microsoft personal หรือ Microsoft 365 work/school เพราะขั้นตอน consent ต่างกัน

## Data safety

- ความก้าวหน้านับเฉพาะรายการที่ Staff อนุมัติแล้ว
- QR มีเฉพาะ token สำหรับค้นหานักศึกษา ไม่มีชื่อผู้ป่วยหรือรายละเอียดเคส
- ห้ามกรอกชื่อผู้ป่วย เลขบัตรประชาชน หรือข้อมูลที่ระบุตัวบุคคลได้
- ก่อนใช้งานจริงต้องกำหนด PDPA, retention, incident response, backup schedule และผู้มีสิทธิ์กู้คืนข้อมูล

## Verification

```bash
pnpm build
```

ตรวจ browser ที่ breakpoint อย่างน้อย 1440px, 1024px และ 390px รวมถึง Student submit, required-field validation, QR display, Staff approval/rejection และ horizontal overflow
