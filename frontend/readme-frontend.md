> **อัปเดต (ต.ค. 2026):** ระบบยืนยันตัวตนเปลี่ยนเป็น Supabase Auth sessions, เพิ่ม migration `001_secure_commerce.sql` (RLS, order_items, ที่อยู่, การจองสต็อก), Stripe webhook เป็นแหล่งยืนยันการชำระเงินเพียงแห่งเดียว และแจ้งเตือน LINE ไปยังกลุ่มแอดมิน — ดูขั้นตอนติดตั้งและตัวแปร env ล่าสุดใน `../README.md`
> *(Updated Oct 2026: see ../README.md for the current architecture, migrations, env vars and setup. Parts of this file describe the previous design.)*

# Silver Thief Bug (SilverTB) - Frontend Architecture

เอกสารฉบับนี้อธิบายโครงสร้างการทำงาน หลักการ แนวคิด และ Workflow ของระบบ Frontend สำหรับโปรเจกต์ **Silver Thief Bug** ซึ่งเป็นแอปพลิเคชัน E-commerce สำหรับการขายแมลง

## 📌 Technology Stack
- **Framework/Library:** React.js (สร้างด้วย Create React App) + TypeScript
- **Styling:** Tailwind CSS
- **Routing:** React Router v7 (`react-router-dom`)
- **State Management:** React Context API
- **Animations / UI:** Framer Motion, SweetAlert2 (สำหรับ Pop-up/Alerts) และ Chart.js (สำหรับแดชบอร์ด)
- **API Fetching:** Axios
- **Payment Elements:** Stripe React Elements (`@stripe/react-stripe-js`)
- **Icons:** Lucide React

---

## 📂 โครงสร้างโฟลเดอร์และไฟล์ (Directory Structure)

```text
frontend/
├── .env                    # ตัวแปรสภาพแวดล้อม (Environment Variables) เช่น Data API keys, Stripe Publishable Key
├── package.json            # จัดการ Dependencies ต่างๆ และ Scripts การรัน
├── tailwind.config.js      # ตั้งค่าการออกแบบและ Theme ของ Tailwind CSS
├── tsconfig.json           # การตั้งค่าสำหรับ TypeScript
└── src/                    # Source code หลักของระบบ Frontend
    ├── App.tsx             # จุดศูนย์รวม Routing (ตั้งค่าเส้นทางหน้าเว็บต่างๆ)
    ├── index.tsx           # Entry point ที่เรนเดอร์ React App และเรียกใช้ Context Providers
    ├── index.css           # ไฟล์ CSS หลัก (นำเข้า Tailwind Base)
    ├── component/          # โฟลเดอร์รวม UI Components ย่อยที่นำไปใช้ซ้ำ
    │   ├── common/         # คอมโพเนนต์ทั่วไป เช่น `Modal.tsx`, `NotificationToast.tsx`
    │   └── layout/         # คอมโพเนนต์โครงหน้าหลัก เช่น `Navbar.tsx`, `Footer.tsx`
    ├── contexts/           # ระบบ Global State Management ของแอปด้วย React Context API
    │   ├── AuthContext.tsx      # จัดการสถานะการล็อคอินของ User
    │   ├── CartContext.tsx      # จัดการตะกร้าสินค้าข้ามแต่ละหน้า
    │   └── FavoritesContext.tsx # จัดการรายการสินค้าโปรดของ User
    ├── pages/              # โฟลเดอร์รวมหน้าต่างของเว็บไซต์ (Page Views)
    │   ├── Home.tsx            # หน้าแรก (Landing Page)
    │   ├── Products.tsx        # หน้าแสดงรายการสินค้าแมลงทั้งหมดและฟิลเตอร์
    │   ├── Cart.tsx            # หน้าแสดงตะกร้าสินค้า
    │   ├── Checkout.tsx        # หน้าชำระเงิน (พ่วงกับ Stripe)
    │   ├── Favorites.tsx       # หน้าแสดงสินค้าดอง/รายการโปรด
    │   ├── Login.tsx           # หน้าเข้าสู่ระบบและสมัครสมาชิก
    │   └── AdminDashboard.tsx  # หน้าแดชบอร์ดสำหรับสรุปยอดขายและการจัดการสำหรับ Admin เท่านั้น
    └── lib/                # ไฟล์ Utilities หรือการตั้งค่าคอนฟิก External Services ตัวอื่นๆ
```

---

## 🧠 หลักการและแนวคิด (Core Concepts)

1. **Single Page Application (SPA):** ระบบพัฒนาด้วย React ทำให้การเปลี่ยนหน้าเว็บลื่นไหล ไม่ต้องโหลดหน้าใหม่ทั้งหมดทุกครั้ง อาศัยการทำ Client-Side Routing ด้วย React-Router 
2. **Context-based State Management:** แทนที่จะใช้ไลบรารีจัดการ State ขนาดใหญ่อย่าง Redux ระบบนี้เลือกใช้ `Context API` + `Hooks` เช่น `useAuth` หรือ `useCart` เพื่อแชร์สถานะข้อมูล (Global state) ข้าม Component อย่างมีประสิทธิภาพ
3. **Component Reusability:** แบ่งแยกโครงสร้างชัดเจนระหว่าง `Pages` (หน้าเว็บที่ประกอบไปด้วย component) และ `Components` (โครงสร้างย่อยๆ) เช่น การแยก Layout Navbar ออกมาให้เรียกใช้ได้กับทุกหน้าเพจ
4. **Interactive UI & UX:** มีการเพิ่ม Micro-animations ขนาดย่อยและ Page Transitions ด้วยรูปภาพนุ่มนวลผ่าน **Framer Motion** และใช้ **SweetAlert2** เพื่อให้แจ้งเตือน Alert น่าดึงดูดและไม่น่าเบื่อ
5. **Secure Payment Client:** ใช้ Standard Component ของ Stripe ควบคุมการกรอกบัตรและติดต่อกับเซิร์ฟเวอร์ Stripe โดยตรง (PCI compliant) ข้อมูลบัตรจะไม่ผ่านการแฮนเดิลเองบนโค้ด Frontend ของเรา

---

## 🔄 Workflow การทำงานที่สำคัญ

### 1. Workflow ของ User State (Authentication)
- เมื่อเริ่มต้นโหลดเว็บ: `AuthContext` จะทำการตรวจเช็ค Token (ปกติเก็บใน LocalStorage) และดึงข้อมูล User จากระบบ Backend
- **สถานะ Navbar:** Navbar จะสะท้อนตามสถานะของ User เช่น หากไม่ได้ล็อกอินจะแสดงปุ่ม "Login" และถ้าล็อกอินแล้ว จะแสดงเมนู Profile, จำนวนสินค้าในตะกร้า(Badge) และปุ่ม Logout
- **การจำกัดสิทธิ์ (Protected Routes):** หน้ากึ่งผู้ดูแล (Dashboard) หรือหน้ากรอกข้อมูลการจ่ายเงิน (Checkout) จะมีการเขียนเช็ค หากสถานะ Auth ยังไม่ผ่านก็จะเด้งผู้ใช้กลับเข้าสู่หน้า Login เสมอ

### 2. Workflow ตะกร้าสินค้า (Cart & Checkout)
- **การเพิ่มสินค้า (Products -> Cart):** ผู้ใช้กด Add to Cart ลงตะกร้าในหน้า `Products.tsx` > ส่งคำสั่งไปอัปเดต state ใน `CartContext.tsx`
- **ตระกร้า:** ตะกร้าสินค้าสามารถกดเพิ่ม/ลด จำนวน และคำนวณราคาเรียลไทม์ 
- **การชำระเงิน (Checkout):** 
  1. หาก User ยืนยันสินค้า จะโยกไปหน้า `Checkout.tsx`
  2. Frontend ขอทำรายการสร้าง "Payment Intent" ไปยัง Backend ของเรา
  3. นำ Payment Intent ID ที่ได้ กลับมากรอกและเรนเดอร์ในองค์ประกอบบัตรของ Stripe เพื่อให้ลูกค้ายืนยันและหักบัตรเครดิต

### 3. Workflow ของ Admin Dashboard
- สิทธิ์ในการเข้าถึงหน้า **AdminDashboard.tsx** จะต้องผ่านการตรวจระดับ Role `admin` จาก Context
- เมื่อเข้าหน้านี้ Frontend จะส่ง API request (Axios) ไปที่ Backend เพื่อขอดึงข้อมูลประวัติ Orders, สถิติผู้ใช้งาน และสินค้า 
- จากนั้นนำข้อมูลลง **Chart.js** เพื่อเรนเดอร์ให้กลายเป็น Visualization กราฟรายได้ เพื่อให้ Admin เฝ้าสังเกตการณ์ระบบได้ง่าย
