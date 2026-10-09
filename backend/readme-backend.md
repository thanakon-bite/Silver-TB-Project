> **อัปเดต (ต.ค. 2026):** ระบบยืนยันตัวตนเปลี่ยนเป็น Supabase Auth sessions, เพิ่ม migration `001_secure_commerce.sql` (RLS, order_items, ที่อยู่, การจองสต็อก), Stripe webhook เป็นแหล่งยืนยันการชำระเงินเพียงแห่งเดียว และแจ้งเตือน LINE ไปยังกลุ่มแอดมิน — ดูขั้นตอนติดตั้งและตัวแปร env ล่าสุดใน `../README.md`
> *(Updated Oct 2026: see ../README.md for the current architecture, migrations, env vars and setup. Parts of this file describe the previous design.)*

# Silver Thief Bug (SilverTB) - Backend Architecture

เอกสารฉบับนี้อธิบายโครงสร้างการทำงาน หลักการ แนวคิด และ Workflow ของระบบ Backend สำหรับโปรเจกต์ **Silver Thief Bug** ซึ่งเป็น E-commerce สำหรับการขายแมลง

## 📌 Technology Stack
- **Framework:** Node.js + Express.js
- **Database:** Supabase (PostgreSQL)
- **Authentication:** JWT (JSON Web Tokens) ร่วมกับ bcryptjs สำหรับจัดการรหัสผ่าน
- **Payment Gateway:** Stripe
- **Notifications:** LINE bot SDK สำหรับการแจ้งเตือน
- **Security:** Helmet, CORS, Express-Rate-Limit

---

## 📂 โครงสร้างโฟลเดอร์และไฟล์ (Directory Structure)

```text
backend/
├── .env                  # ตัวแปรสภาพแวดล้อม (Environment Variables) เช่น Data API keys
├── server.js             # จุดศูนย์กลางในการรันเซิร์ฟเวอร์ Express, การตั้งค่า Middleware และ Routes
├── package.json          # จัดการ Dependencies ต่างๆ และ Scripts การรัน
├── check_db.js           # สคริปต์เสริมสำหรับตรวจสอบการเชื่อมต่อและสถานะฐานข้อมูล
└── src/                  # Source code หลักของระบบ
    ├── config/           
    │   └── supabase.js   # ตั้งค่าการเชื่อมต่อฐานข้อมูล Supabase ด้วย Service Role Key (Bypass RLS สำหรับใช้งานฝั่ง Server)
    ├── db/               
    │   ├── schema.sql    # ไฟล์โครงสร้างตารางของฐานข้อมูล (Database Schema)
    │   └── seed.sql      # ไฟล์ข้อมูลตั้งต้น (Mock Data) สำหรับการทดสอบ
    ├── middleware/       
    │   └── auth.js       # Middleware จัดการการยืนยันตัวตน (JWT Authentication) และตรวจสอบสิทธิ Admin
    └── routes/           # ตัวจัดการ API Endpoints หรือ Router ทั้งหมด
        ├── auth.js       # ระบบสมาชิก (Register, Login, Profile)
        ├── products.js   # ระบบจัดการสินค้าแมลง (CRUD)
        ├── orders.js     # ระบบจัดการคำสั่งซื้อของ User
        ├── payments.js   # ระบบประสานงานตั้งค่าชำระเงินกับ Stripe และ Webhook
        └── notifications.js # ระบบส่งแจ้งเตือนผ่าน LINE
```

---

## 🧠 หลักการและแนวคิด (Core Concepts)

1. **RESTful API:** การออกแบบ API ยึดหลัก RESTful เน้นให้ Client (Frontend) ติดต่อผ่าน HTTP Methods (GET, POST, PUT, DELETE) ที่สื่อความหมาย
2. **Stateless Authentication:** ใช้ **JWT (JSON Web Token)** ในการรับรองตัวตน โดยไม่จำเป็นต้องเก็บ session ไว้ที่เซิร์ฟเวอร์ เพื่อให้สามารถสเกลได้ง่าย
3. **Database Client Management:** เชื่อมต่อ Supabase ผ่าน Service Role Key จากฝั่ง Backend ทำให้ไม่ต้องกังวลเรื่อง Row Level Security (RLS) จากฝั่ง Client และรักษาความปลอดภัยได้อย่างเด็ดขาด
4. **Security Priority:** 
   - มีการเข้ารหัส (Hash) รหัสผ่านด้วย `bcryptjs`
   - ป้องกันการโจมตี HTTP Headers ด้วย `helmet`
   - การสกัดกั้น Brute Force หรือ Spam Requests ด้วย `express-rate-limit`
5. **Webhook Pattern:** ใช้สำหรับการรับค่าสถานะย้อนกลับจาก External Services (เช่น แจ้งสถานะการชำระเงินสำเร็จจาก Stripe)

---

## 🔄 Workflow การทำงานที่สำคัญ

### 1. Workflow การยืนยันตัวตน (Authentication Flow)
- **ลงทะเบียน (Register):** รับข้อมูลจาก User ข้อมูลจะถูก Hash รหัสผ่านและบันทึกลง Supabase `profiles` table
- **เข้าสู่ระบบ (Login):** ค้นหา User ตาม Email นำรหัสผ่านมาเปรียบเทียบ หากถูกต้อง จะสร้าง **JWT Token** และส่งกลับไปให้ Frontend ไปเก็บ (ปกติใน localStorage หรือ Zustand store)
- **เรียกดูข้อมูล (Access Protected Routes):** ทุกครั้งที่ Frontend ส่ง request เข้ามายัง private path จะต้องแนบ JWT เข้ามาใน HTTP Header (`Authorization: Bearer <token>`) โดย `middleware/auth.js` จะเป็นตัวแกะ token และตรวจเช็คก่อนส่งไปหา Controller

### 2. Workflow การชำระเงิน (Stripe Payment Flow)
- **สร้างคำสั่งซื้อ:** เมื่อ User ยืนยันตะกร้า ระบบจะสร้าง record ลงในตาราง `orders` พร้อมคำนวณราคาสุทธิ
- **สร้าง Stripe Session:** Backend ส่งข้อมูลรายการสินค้าไปหา Stripe เพื่อขอ URL ลิงก์ไปหน้าชำระเงิน แล้วส่งต่อกลับไปให้ Frontend
- **การแจ้งเตือนเบื้องหลัง (Stripe Webhook):** เมื่อ User จ่ายเงินที่หน้าเว็บ Stripe สำเร็จ Stripe จะยิงกลับมาที่ Endpoint `/api/payments/webhook` ของเรา 
- **อัปเดตสถานะ:** เมื่อ Backend ได้รับ Webhook และยืนยันความถูกต้อง จะทำการปรับสถานะ `shipping_status` และ `payment_status` ของออเดอร์นั้นให้เป็น "Paid" แบบอัตโนมัติ

### 3. Workflow การแจ้งเตือนผ่าน LINE
- หลังจากมีกิจกรรมสำคัญๆ เช่น ออเดอร์ซื้อสำเร็จ จะมีการเรียกฟังก์ชันใน `routes/notifications.js`
- ส่งรายละเอียดคำสั่งซื้อผ่าน **Line Messaging API** เข้าไปที่ห้องแชท หรือ LINE ของ Admin เพื่อให้ทีมงานสามารถแพ็คของส่งได้อย่างรวดเร็ว

---

นี่คือภาพรวมทั้งหมดของการออกแบบ Backend สำหรับโปรเจกต์ SilverTB โครงสร้างสามารถปรับขยายเพิ่มเติม (Scalable) ได้ในอนาคต หากมีฟีเจอร์ใหม่ๆ ครับ
