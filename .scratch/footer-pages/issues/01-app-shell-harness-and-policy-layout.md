# 01: ชุดทดสอบ App shell + โครงหน้านโยบาย + ส่วนติดต่อร่วม (prefactor)

**What to build:** ให้ test harness เดิม (`renderPage`) mount ทั้ง App shell (navbar, routes, footer) ที่ URL ใดก็ได้ โดยใช้ Auth/Cart provider จริงและคำแปลไทยจริง และ mock เฉพาะ API adapter กับ Supabase สร้างโครงหน้านโยบายแบบเดียว (PageHeader + เนื้อหา prose + "อัปเดตล่าสุด") ให้หน้า Shipping, FAQ, Terms และ Privacy ใช้ร่วมกัน และแยกส่วนติดต่อ (โทร อีเมล โซเชียล ที่อยู่ แผนที่) ออกจากหน้า About มาเป็นชิ้นที่ใช้ซ้ำได้ หน้า About ต้องหน้าตาและการทำงานเหมือนเดิม

**Blocked by:** None (can start immediately)

**Status:** done

- [x] test render App shell ที่ URL ที่กำหนดได้ (มี navbar, หน้าของ route นั้น และ footer)
- [x] test: footer มีลิงก์ "เลือกซื้อสินค้าทั้งหมด", "รายการโปรด", "นโยบายจัดส่ง", "คำถามที่พบบ่อย"
- [x] มีโครงหน้านโยบายที่ใช้ร่วมกันได้ ใช้ token และ type scale จาก `design.md` ไม่มีสไตล์เฉพาะหน้า
- [x] หน้า About ใช้ส่วนติดต่อร่วม และแสดงผลเหมือนเดิม
- [x] test เดิม (Checkout, OrderDetail) ผ่านทั้งหมด
- [x] `npm test`, type-check และ `CI=true npm run build` ของ frontend ผ่าน
