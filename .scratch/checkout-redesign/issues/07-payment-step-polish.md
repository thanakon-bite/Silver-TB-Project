# 07: ปุ่มและขั้นชำระเงิน

**What to build:** ปุ่มหลักส้มเข้มทึบผ่าน contrast, ปุ่ม Pay เหลือ "ชำระ ฿…" และบรรทัดเล็ก "บัตร / พร้อมเพย์", ตัวนับถอยหลัง tabular-nums, เคารพ reduced-motion, ตัดเลขขั้นซ้ำในหัวข้อ

**Blocked by:** 02, 05

**Status:** done

- [x] test: กด Pay → เรียก checkout-session ของ Order แล้วไปที่ URL ที่ได้
- [x] label ปุ่ม Pay ไม่ตัดสองบรรทัดที่ 320 px
- [x] ไม่มี gradient และเงาฟุ้งบนปุ่ม
