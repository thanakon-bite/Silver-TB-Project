# 03: ยกเลิกโดยยืนยันในหน้า และ error code ใหม่

**What to build:** ลิงก์ "ยกเลิกคำสั่งซื้อ" ใต้ปุ่มชำระ กดแล้วยืนยันในหน้าด้วยปุ่ม [ยืนยันยกเลิก] และ [เก็บไว้] (โฟกัสอยู่ที่ "เก็บไว้") ยกเลิกสำเร็จแล้วหัวเป็น "ยกเลิกแล้ว" ยกเลิกไม่ได้ → กล่อง error ภาษาไทยเหนือปุ่ม ถ้าจริงๆ จ่ายแล้วให้โหลด Order ใหม่ backend ปฏิเสธการยกเลิกด้วย code ORDER_NOT_CANCELLABLE หน้านี้ไม่ใช้ SweetAlert อีก

**Blocked by:** 01

**Status:** done

- [x] test: "เก็บไว้" ไม่เรียก API, "ยืนยันยกเลิก" ส่ง POST cancel และหัวเป็น "ยกเลิกแล้ว"
- [x] test: ถูกปฏิเสธด้วย ORDER_NOT_CANCELLABLE → คำไทยใน role=alert ไม่มี popup
- [x] หน้าไม่ import sweetalert2 (ตรวจด้วย grep แบบเดียวกับ checkout ticket 06 ไม่เขียนเป็น test เพราะจะผูกกับโค้ดภายใน)
- [x] backend unit: ลูกค้ายกเลิกได้เฉพาะ Pending ที่ยังไม่จ่าย นอกนั้นได้ code ORDER_NOT_CANCELLABLE
