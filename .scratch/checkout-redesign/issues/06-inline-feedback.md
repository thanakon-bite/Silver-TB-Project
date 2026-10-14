# 06: แจ้ง error ในหน้าแทน popup

**What to build:** สร้าง Order ไม่สำเร็จ → กล่องข้อความเหนือปุ่มพร้อมบอกสิ่งที่ต้องทำต่อ, Reservation หมดเวลา → กลับขั้นที่ 1 พร้อมแถบแจ้งด้านบน หน้า checkout ไม่ใช้ SweetAlert2

**Blocked by:** 01

**Status:** done

- [x] test: API สร้าง Order ล้มเหลว → ข้อความ error แสดงในหน้า (role=alert) และไม่มี popup
- [x] test: Reservation หมดเวลา → กลับขั้นที่ 1 และแสดงแถบแจ้ง
- [x] หน้า checkout ไม่ import SweetAlert2
