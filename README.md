# Surgery CMU Multi-year Logbook

เว็บบันทึก Logbook นักศึกษาแพทย์แบบต่อเนื่องหลายชั้นปี ใช้บัญชี รูป และ QR เดิมตลอดหลักสูตร แต่แยก curriculum/enrollment/ปีการศึกษาอย่างชัดเจน รองรับอีเมลยืนยันตัวตน การรีเซ็ตรหัสผ่าน การตรวจอนุมัติพร้อม audit trail และการสำรอง PDF/Excel ไป Google Drive ของภาควิชา

## Architecture

- Frontend: React + Vite แบบ responsive สำหรับ desktop, tablet และ mobile
- Authentication: Supabase Auth (email verification และ password-reset link) ส่งผ่าน Gmail บัญชีเฉพาะระบบ
- Primary database: Supabase PostgreSQL พร้อม Row Level Security
- Approval: Student ส่งรายการ แล้ว Staff ตรวจชื่อ/QR ก่อน approve หรือส่งกลับแก้ไข
- Backup: Vercel serverless function สร้าง PDF/Excel และอัปโหลดไป Google Drive ผ่าน OAuth แบบ persistent access

Google Drive ไม่ได้ใช้แทนฐานข้อมูลหลัก เพราะไม่เหมาะกับ transaction, concurrent editing, RLS และ audit log แต่ใช้เป็นปลายทางสำรองไฟล์ที่ Admin เรียกสร้างได้

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
- Admin: `http://127.0.0.1:5173/?demo=admin`

## Environment variables

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
VITE_APP_URL=https://logbook-surgery-website.vercel.app

# server-only: ห้ามใช้ VITE_ prefix และห้ามส่งไป browser
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_REFRESH_TOKEN=your-persistent-refresh-token
GOOGLE_DRIVE_ACCOUNT_EMAIL=edusurgcmu@gmail.com
```

Publishable key ใช้ฝั่ง browser ได้ เพราะสิทธิ์ข้อมูลจริงถูกบังคับด้วย RLS ห้ามใส่ Supabase `service_role` key หรือ Microsoft client secret ใน frontend

โปรเจกต์นี้ต้องใช้ Supabase project แยกเฉพาะ Surgery Logbook ห้ามชี้ `VITE_SUPABASE_URL` ไปยัง project ของ Breast Surgery/Fellow Training ระบบจะหยุดทำงานทันทีหากตรวจพบ project เดิม เพื่อป้องกันข้อมูลผู้ใช้และ Auth ปะปนกันอีก

## Database setup

สำหรับ Supabase project ใหม่ ให้ใช้ schema แบบ standalone ที่ `supabase/year4_schema.sql` เท่านั้น ส่วนระบบที่ติดตั้งแล้วให้อัปเกรดตามลำดับไฟล์ใน `supabase/migrations/` โดยประกอบด้วย:

- Student/Staff profiles และ QR token แบบสุ่ม
- รายการกิจกรรม 17 หมวดและเป้าหมายจาก Logbook ปี 4
- สถานะ `draft`, `submitted`, `approved`, `rejected`
- ประวัติ approval/rejection แบบ append-only
- RLS ที่จำกัด Student ให้เห็นและแก้ไขเฉพาะข้อมูลของตนเอง
- การมอบหมาย Staff ต่อรายการ โดยอนุญาตให้เฉพาะ Staff ที่นักศึกษาเลือกเป็นผู้ approve/reject
- Supabase Storage bucket `student-avatars` แบบ private สำหรับรูปนักศึกษาไม่เกิน 5 MB
- `curricula`, `curriculum_activities`, `curriculum_staff_approvers` และ `student_enrollments` สำหรับหลายชั้นปี
- Promotion แบบ transaction เดียว พร้อม certification gate, password-confirmed override, rollback และ audit trail

Migration `20260825090000_multi_curriculum_enrollments.sql` สร้าง Year 4/2568 แบบ published และรักษา ID/status/timestamp เดิมทั้งหมด ส่วน Year 5/2569 จาก `ปี 5เล่มเล็ก-2569.doc` ถูกนำเข้าเป็น **draft 12 กิจกรรม เป้าหมายรวม 53 รายการ** จึงยังใช้เลื่อนชั้นไม่ได้จนกว่า Admin จะตรวจเป้าหมาย (รวม CVP ที่ตั้ง draft ไว้ 1 ราย), สร้าง rotation และกด Publish

ตรวจ project reference ให้ถูกต้องก่อนรัน SQL ทุกครั้ง แล้วจึงสร้างบัญชี Staff ผ่านกระบวนการผู้ดูแลระบบ ห้ามรัน migration ของ Breast/Fellow Training ใน project นี้

## Authentication setup

ใน Supabase Auth:

1. เปิด Email provider และเปิด Confirm email
2. ตั้ง Site URL เป็น production URL
3. เพิ่ม Redirect URL เช่น `https://your-domain/reset-password`
4. สำหรับ local development เพิ่ม `http://127.0.0.1:5173/reset-password`
5. ปรับ email templates ให้ระบุชื่อระบบและช่องทางติดต่อภาควิชา
6. ก่อนใช้งานจริงให้ตั้ง Custom SMTP (เช่น Microsoft 365 SMTP, Resend, Postmark หรือ Amazon SES) เพราะ SMTP เริ่มต้นของ Supabase ใช้สำหรับการทดลอง มีข้อจำกัดผู้รับและ rate limit ต่ำ

Student สมัครได้เองด้วยชื่อ–นามสกุล รหัสนักศึกษา กลุ่มที่ อีเมล และรหัสผ่าน โดยต้องยืนยันอีเมลก่อนเข้าสู่ระบบ ไม่ต้องเพิ่มอีเมลใน allowlist ล่วงหน้า ส่วนสิทธิ์ Staff และ Admin ต้องกำหนดอีเมลโดยผู้ดูแลในฐานข้อมูล การเลือกปุ่ม Staff/Admin ในหน้าเว็บไม่สามารถยกระดับสิทธิ์ได้ รายชื่อ dropdown มาจาก Staff allowlist จึงเลือกผู้ประเมินได้ก่อนที่ Staff จะเปิดบัญชี แต่ผู้ประเมินจะเข้าอนุมัติได้หลังเปิดบัญชีและยืนยันอีเมลเรียบร้อยแล้วเท่านั้น

รายชื่อ Staff ปี 4 นำเข้าจาก `รายชื่ออาจารย์ ปี 4.xlsx` จำนวน 34 คน (ไม่รวมแถวที่ระบุว่า `test`) โดย dropdown และรายการ Logbook แสดงชื่ออาจารย์จาก `full_name` ส่วนอีเมลใช้เป็นตัวระบุภายในสำหรับบังคับให้เฉพาะ Staff ที่นักศึกษาเลือกเป็นผู้อนุมัติได้

Admin allowlist ปัจจุบันมี `edusurgcmu@gmail.com` และ `surgerycmuyear4@hotmail.com` เปิดบัญชีได้ที่ `https://logbook-surgery-website.vercel.app/?register=admin` หลัง migration ถูกติดตั้งแล้ว หน้า Admin ส่งออก PDF/Excel ได้ทั้งรายคน ตามกลุ่ม Curriculum และรวมทุกคน การลบจะลบเฉพาะ Logbook และ Approval Audit ที่สัมพันธ์กัน โดย Edge Function `admin-data` ตรวจรหัสผ่าน Admin ซ้ำก่อนใช้ service role; บัญชี Auth, Student profile และรูปนักศึกษาจะไม่ถูกลบ

### Gmail SMTP สำหรับ Supabase Auth

สร้าง Gmail ใหม่ที่ใช้กับระบบนี้เท่านั้น เปิด 2-Step Verification แล้วสร้าง App Password จากนั้นตั้งที่ Supabase → Authentication → Emails → SMTP Settings:

- Host: `smtp.gmail.com`
- Port: `587`
- Username และ Sender email: Gmail บัญชีเฉพาะระบบเดียวกัน
- Password: Google App Password 16 ตัว ไม่ใช่รหัสผ่าน Gmail ปกติ
- Sender name: `Surgery CMU Logbook`

App Password ให้เก็บเฉพาะใน Supabase SMTP Settings ห้ามใส่ใน repository, `.env` ฝั่ง frontend หรือ Vercel environment variables หลังบันทึกให้ทดสอบ Confirm signup และ Reset password กับ Gmail, Hotmail และอีเมล CMU อย่างละหนึ่งบัญชี

## Google Drive backup

ตัวเชื่อมใช้ Google OAuth refresh token ของ `edusurgcmu@gmail.com` ซึ่งเก็บเฉพาะใน Vercel server environment ปุ่มสำรองแสดงเฉพาะ Admin และ server ตรวจ Supabase JWT กับ role ซ้ำก่อนสร้างไฟล์ `Surgery_Logbook_MultiYear_Backup_<timestamp>.xlsx/.pdf`

Excel มี Curricula, Enrollments, Students, Logbook, Approval Audit, Rotations, Certifications, Program Quality, Data Anomalies, Promotion Audit และ Manifest โดยทุก Logbook ระบุชั้นปี ปีการศึกษา curriculum, enrollment, กลุ่ม, timestamp ตอน Student ส่งและ Staff อนุมัติ

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
