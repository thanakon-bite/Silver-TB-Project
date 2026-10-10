# 01: ชุดทดสอบหน้า Checkout (prefactor)

**What to build:** ลบ test ค่าเริ่มต้นของ CRA ที่พัง แล้วสร้างชุดทดสอบที่ render หน้า Checkout ทั้งหน้า: mock เฉพาะ API adapter และ Supabase client, ใช้ Cart/Auth provider จริง และคำแปลไทยจริง

**Blocked by:** None (can start immediately)

**Status:** done

- [x] test เดิมที่หา "learn react" ถูกลบ
- [x] render หน้า Checkout ได้ใน test พร้อม Cart ที่มีของ และ Customer ที่ login แล้ว
- [x] test: บรรทัดค่าจัดส่งแสดง "ฟรี" เมื่อ Shipping Fee เป็น 0
- [x] test: error ของช่องหายเมื่อแก้ช่องนั้น
- [x] `npm test` ของ frontend ผ่าน
