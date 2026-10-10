# 03: ทดสอบ backend ที่แก้ไปแล้ว

**What to build:** เพิ่ม test ระดับ HTTP ให้ endpoint ค่าจัดส่ง และ test ว่า server ไม่เริ่มเมื่อใช้ live key นอก production

**Blocked by:** None (can start immediately)

**Status:** done

- [x] GET shipping-fee ตอบ Shipping Fee โดยไม่ต้อง login
- [x] server ไม่ยอมเริ่มเมื่อ live key + NODE_ENV ไม่ใช่ production
- [x] ALLOW_LIVE_STRIPE=1 ทำให้เริ่มได้
- [x] `npm test` ของ backend ผ่าน
