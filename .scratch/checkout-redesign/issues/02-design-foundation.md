# 02: รากฐานดีไซน์ทั้งเว็บ

**What to build:** token สีตามบทบาท (paper, ink, muted, line, accent, accent-ink, success, danger) ทั้ง light/dark ผูกเข้า Tailwind, ฟอนต์ Noto Serif Thai + IBM Plex Sans Thai + IBM Plex Mono, title "Silver Thief Bug", เครื่องหมายด้วง SVG เป็นโลโก้และ favicon หน้าเดิมที่ใช้ gray-* ยังเหมือนเดิม

**Blocked by:** None (can start immediately)

**Status:** done

- [x] token ใช้ได้เป็นคลาส Tailwind (เช่น bg-paper, text-ink) และสลับค่าตาม dark mode
- [x] ฟอนต์ทั้งสามโหลดจริงเฉพาะน้ำหนักที่ใช้
- [x] แท็บเบราว์เซอร์แสดง title และ favicon รูปด้วง
- [x] accent สำหรับปุ่มผ่าน contrast 4.5:1 กับ accent-ink ทั้งสองโหมด
- [x] typecheck ผ่าน
