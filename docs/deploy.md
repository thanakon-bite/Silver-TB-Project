# Deploy แบบฟรี: Render (backend) + Vercel (frontend)

ผลลัพธ์: เว็บร้านเปิดได้จากทุกที่ผ่าน browser เช่น `https://silver-tb.vercel.app` และ API อยู่ที่ `https://silver-tb-api.onrender.com`
(ชื่อจริงขึ้นกับชื่อที่ว่างตอนสร้าง ให้แทนชื่อในคู่มือนี้ด้วยชื่อของคุณ)

ไฟล์ตั้งค่าที่เตรียมไว้ใน repo แล้ว:
- `render.yaml`: บอก Render ว่า backend อยู่ในโฟลเดอร์ `backend` รันด้วย `node server.js` และต้องใส่ secret ตัวไหนบ้าง
- `frontend/vercel.json`: ให้ทุกหน้า (เช่น `/cart`, `/admin`) เปิดตรงๆ ได้โดยไม่ขึ้น 404

ใช้เวลาประมาณ 30–45 นาที ต้องมีบัญชี GitHub (repo `blnisbear/Silver-TB-Project` ถูก push แล้ว) และ Supabase เดิม (รัน migration 001–006 แล้ว)

---

## 1. Backend บน Render

1. เข้า https://render.com สมัครด้วยบัญชี GitHub (แพ็กเกจ Free ไม่ต้องใส่บัตร)
2. กด **New → Blueprint** แล้วเลือก repo `Silver-TB-Project` (ถ้าไม่เห็น ให้กด *Configure GitHub* แล้วอนุญาต repo นี้)
3. Render จะอ่าน `render.yaml` และสร้างบริการชื่อ `silver-tb-api` ให้ แล้วขอค่าที่เป็นความลับ ให้คัดลอกจาก `backend/.env` บนเครื่องคุณ:

   | ช่อง | ใส่อะไร |
   |---|---|
   | `FRONTEND_URL` | ตอนนี้ใส่ `https://example.com` ไปก่อน (จะกลับมาแก้ในขั้นที่ 3) |
   | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | จาก `backend/.env` |
   | `STRIPE_SECRET_KEY` | จาก `backend/.env` (ใช้ key โหมดทดสอบ `sk_test_…` สำหรับเดโม) |
   | `STRIPE_WEBHOOK_SECRET` | ใส่ `whsec_placeholder` ไปก่อน (ได้ค่าจริงในขั้นที่ 5) |
   | `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `LINE_OWNER_USER_ID` | จาก `backend/.env` |

4. กด **Apply** รอ build ประมาณ 3–5 นาที
5. ทดสอบ: เปิด `https://silver-tb-api.onrender.com/api/health` ต้องเห็น `{"status":"ok",...}`

## 2. Frontend บน Vercel

1. เข้า https://vercel.com สมัครด้วยบัญชี GitHub (แพ็กเกจ Hobby ฟรี)
2. กด **Add New → Project** แล้ว Import repo `Silver-TB-Project`
3. ตั้งค่าก่อนกด Deploy:
   - **Root Directory**: กด Edit แล้วเลือก `frontend`
   - **Framework Preset**: Create React App (ปกติเลือกให้เอง)
   - **Environment Variables** (ค่าเหล่านี้เป็นค่าสาธารณะ อยู่ใน `frontend/.env`):
     - `REACT_APP_SUPABASE_URL` = ค่าเดียวกับใน `frontend/.env`
     - `REACT_APP_SUPABASE_ANON_KEY` = ค่าเดียวกับใน `frontend/.env` (anon key เท่านั้น ห้ามใส่ service role key)
     - `REACT_APP_API_URL` = `https://silver-tb-api.onrender.com/api`
4. กด **Deploy** รอประมาณ 2–3 นาที จะได้ URL เช่น `https://silver-tb.vercel.app`
5. **สำคัญ:** งานอยู่บน branch `fix/checkout-polish` ซึ่ง Vercel จะถือเป็น "Preview" และบังคับให้ล็อกอิน Vercel ก่อนเปิดดู ให้ไปที่ **Settings → Git → Production Branch** เปลี่ยนเป็น `fix/checkout-polish` แล้วกด **Redeploy** (หรือ merge เข้า `main` ก่อน deploy ก็ได้)

## 3. บอก backend ว่าเว็บอยู่ที่ไหน

Render → `silver-tb-api` → **Environment** → แก้ `FRONTEND_URL` เป็น URL ของ Vercel เช่น `https://silver-tb.vercel.app` (ไม่มี `/` ท้าย) แล้ว Save (Render จะ deploy ใหม่เอง)
ค่านี้ใช้อนุญาต CORS ให้หน้าเว็บเรียก API ได้ และใช้สร้างลิงก์ในข้อความ LINE และหน้ากลับจาก Stripe

## 4. Supabase: อนุญาตลิงก์ล็อกอินจากโดเมนใหม่

Supabase Dashboard → **Authentication → URL Configuration**
- **Site URL**: `https://silver-tb.vercel.app`
- **Redirect URLs**: เพิ่ม `https://silver-tb.vercel.app/reset-password` และ `https://silver-tb.vercel.app/login`

ถ้าไม่ตั้ง ลิงก์ยืนยันอีเมลและลิงก์ลืมรหัสผ่านจะพากลับไป localhost

## 5. Stripe webhook (ทำให้ออเดอร์เปลี่ยนเป็น "ชำระแล้ว")

Stripe Dashboard (โหมด Test) → **Developers → Webhooks → Add endpoint**
- **Endpoint URL**: `https://silver-tb-api.onrender.com/api/payments/webhook`
- **Events**: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`
- กด Add แล้วคัดลอก **Signing secret** (`whsec_…`) ไปใส่ `STRIPE_WEBHOOK_SECRET` ใน Render → Environment

## 6. LINE webhook (ให้รายชื่อผู้รับแจ้งเตือนขึ้นในหน้า Admin)

LINE Developers → channel ของร้าน → **Messaging API**
- **Webhook URL**: `https://silver-tb-api.onrender.com/api/notifications/line/webhook`
- เปิด **Use webhook** แล้วกด **Verify** (ถ้า Verify ไม่ผ่านครั้งแรก ให้เปิด `/api/health` ก่อนเพื่อปลุก server แล้วกดอีกครั้ง)
- ให้คนที่จะรับแจ้งเตือนส่งข้อความอะไรก็ได้หา OA หนึ่งครั้ง แล้วไปติ๊กชื่อใน Admin → Payments & LINE

## 7. ลองใช้งาน

1. เปิด URL ของ Vercel ใน browser แล้วล็อกอินด้วยบัญชี Admin
2. ลองสั่งซื้อ แล้วจ่ายด้วยบัตรทดสอบของ Stripe: `4242 4242 4242 4242` วันหมดอายุเป็นวันไหนก็ได้ในอนาคต CVC อะไรก็ได้
3. ออเดอร์ควรเปลี่ยนเป็น "ชำระแล้ว" การ์ด "การชำระเงินจาก Stripe ล่าสุด" ควรมีรายการ และ LINE แจ้งผู้รับที่ติ๊กไว้
4. ถ้าต้องการสินค้าตัวอย่าง 100 รายการ ให้รัน `backend/src/db/scripts/seed_demo_products.sql` ใน Supabase SQL Editor (ดู README หัวข้อ Demo data)

---

## ข้อจำกัดของแพ็กเกจฟรี
- **Render หลับเมื่อไม่มีคนใช้ประมาณ 15 นาที** request แรกหลังหลับจะช้าราวครึ่งนาทีถึงหนึ่งนาที ก่อนเสนอลูกค้าให้เปิดเว็บไว้ก่อนสักนาทีเพื่อปลุก server
- **งานเบื้องหลังจะไม่รันตอน server หลับ** เช่น ยกเลิกออเดอร์ที่หมดเวลาจ่าย และ Confirmed อัตโนมัติหลัง 7 วัน งานจะมาทำตอน server ตื่นครั้งถัดไป ใช้เดโมได้ แต่ถ้าขายจริงควรเปลี่ยนเป็นแพ็กเกจที่ไม่หลับ
- **Stripe ส่ง webhook ซ้ำให้เองถ้า server หลับ** ส่วน LINE ไม่ส่งซ้ำโดยค่าเริ่มต้น ถ้าข้อความหาย ให้ผู้รับทักแชท OA ใหม่
- เงื่อนไขแพ็กเกจฟรีของแต่ละเจ้าเปลี่ยนได้ ให้เช็คหน้าราคาของ Render และ Vercel อีกครั้ง

## เมื่อแก้โค้ดแล้ว push ใหม่
ทั้ง Render และ Vercel จะ deploy ใหม่ให้เองทุกครั้งที่ push ขึ้น branch ที่ตั้งไว้
