# Spec: หมวดหมู่ที่ Admin จัดการเอง, Stock History, โปรโมชั่นแบบ Stackable/Exclusive, แจ้งเตือนเพิ่ม และเก็บงานตะกร้า/หน้าร้าน

**Label:** ready-for-agent
**Branch:** fix/checkout-polish (ห้าม commit / push ให้เจ้าของ repo ทำเอง)
**อ้างอิง:** `CONTEXT.md` (glossary ปรับแล้ว 2026-10-11), ADR 0001 (Stripe-hosted Checkout), ADR 0002 (LINE target จาก env), ADR 0003 (On Hand ลดตอน Confirmed), ADR 0004 (Stackable/Exclusive Promotions), ADR 0005 (Admin-managed Categories), `design.md`

## Problem Statement

หลังรอบ order-flow-promotions ร้านใช้งานจริงแล้วเจอปัญหาดังนี้

**หน้าร้านและตะกร้า**
- Hero สูงเกินไป ดันสินค้าลงไปต่ำกว่าจอแรก
- ลูกค้าใส่สินค้าลงตะกร้าได้มากกว่าจำนวน Available ที่เห็นบนหน้าจอ
- หน้าตะกร้าไม่บอกราคาสินค้ารวมก่อนหักส่วนลดและบวกค่าส่ง
- กดลบสินค้าออกจากตะกร้าแล้วหายทันทีโดยไม่มีการยืนยัน
- กดชำระเงินแล้วระบบสร้าง Order และจองสต็อกแล้ว แต่ตะกร้ายังมีของเดิมค้างอยู่จนกว่าจะจ่ายสำเร็จ ลูกค้าเลยยังแก้หรือลบของที่จริงๆ สั่งไปแล้วได้

**หมวดหมู่**
- หมวดหมู่สินค้าถูก fix ไว้ 4 ค่าในโค้ด Admin เพิ่ม แก้ หรือลบเองไม่ได้
- รายการ Family ของด้วงมาจากข้อความที่พิมพ์ไว้ในสินค้าแต่ละตัว ไม่มีที่จัดการกลาง

**สต็อก**
- ปุ่ม +/− On Hand เปิดช่องกรอกที่เริ่มที่ 1 แต่ Admin อยากเห็นและแก้เป็นจำนวนปัจจุบัน
- หน้า stock ยังใช้คำอังกฤษ Onhand / Stockmove
- ไม่มีประวัติว่าสต็อกเปลี่ยนเพราะอะไร เมื่อไหร่ ใครเป็นคนทำ

**ออเดอร์และแจ้งเตือน**
- ลูกค้ากดยืนยันได้รับสินค้าแล้ว Admin ไม่รู้
- Admin ยืนยันแทนลูกค้า ลูกค้าก็ไม่รู้
- รายการออเดอร์ของ Admin ไม่บอกว่าออเดอร์ Awaiting Payment จะหมดเวลาจ่ายเมื่อไหร่ และออเดอร์ Shipping จะ Confirmed อัตโนมัติเมื่อไหร่
- แจ้งเตือน Shipping มีเลขพัสดุอยู่แล้ว แต่อยู่ในบรรทัดรอง อ่านไม่ชัด

**โปรโมชั่น**
- หน้า Rules แสดงขั้น Discount เป็นข้อความยาว อ่านยาก
- ลูกค้ารู้ว่ามีโปรเฉพาะตอนที่โปรเริ่มแล้วเท่านั้น
- ป้ายบนการ์ดสินค้าแสดงโปรตัวแรก ไม่ใช่ตัวที่คุ้มที่สุด
- ลูกค้าที่ใช้สิทธิ์ครบแล้วยังเห็นป้ายโปรนั้นอยู่
- โปรรวมกันไม่ได้เลย ร้านอยากให้บางโปรรวมกับโปรอื่นได้ ส่วนบางโปรใช้ได้ตัวเดียว
- ตารางแจ้งเตือนเก็บ id ของโปรไว้ใน JSON ไม่มี foreign key

## Solution

**หน้าร้านและตะกร้า**
- ลด Hero ลง 30% ทุก breakpoint
- จำนวนในตะกร้าไม่เกิน Available ทุกทางที่เพิ่มของได้: การ์ด, หน้ารายละเอียดสินค้า, drawer และหน้าตะกร้า ถ้า Available ลดลงหลังใส่ตะกร้าไปแล้ว ระบบลดจำนวนให้และแจ้งลูกค้า
- หน้าตะกร้าแสดงยอดเป็นลำดับ: ราคาสินค้ารวม → ส่วนลด → ค่าจัดส่ง → ยอดชำระ
- ขึ้น SweetAlert ให้ยืนยันทั้งตอนกดลบ และตอนกดลดจำนวนจนเหลือ 0
- ล้าง Cart ทันทีที่ Order ถูกสร้าง ลูกค้าจ่ายต่อหรือยกเลิกจากหน้า Order

**หมวดหมู่**
- เพิ่มแท็บ "หมวดหมู่" ในหน้า Admin สำหรับจัดการ Category และ Family
- `beetle` เป็น Category ระบบ เปลี่ยนชื่อได้แต่ลบไม่ได้
- ลบ Category หรือ Family ที่ยังมีสินค้าใช้อยู่ไม่ได้
- slug ของ Category ไม่เปลี่ยน
- ฟอร์มสินค้าเลือก Family จากรายการ

**สต็อก**
- ปุ่มปรับ On Hand เปิด popup ที่เติม On Hand ปัจจุบันไว้ให้ ตั้งต่ำกว่าจำนวนที่ Reserved ไม่ได้ และมีช่องหมายเหตุ
- Label ไทย: คงคลัง (On Hand), พร้อมขาย (Available)
- ไอคอนประวัติต่อจากไอคอนแก้ไข เปิด Stock History ของสินค้านั้น

**ออเดอร์และแจ้งเตือน**
- เมื่อ Confirmed:
  - ลูกค้ายืนยันเอง → แจ้งกระดิ่ง Admin ทุกคน และส่ง LINE ถึง Owner
  - Admin ยืนยันแทน → แจ้งกระดิ่งลูกค้า
  - ระบบยืนยันอัตโนมัติ → แจ้งทั้งกระดิ่งลูกค้าและกระดิ่ง Admin ไม่ส่ง LINE
- รายการออเดอร์ของ Admin มี countdown สองแบบ:
  - Awaiting Payment: นับถึงเวลาหมดสิทธิ์จอง เป็นสีเตือนเมื่อเหลือน้อยกว่า 1 ชม.
  - Shipping: นับถึงเวลา Confirmed อัตโนมัติ เป็นสีเตือนเมื่อเหลือน้อยกว่า 1 วัน
- แจ้งเตือน Shipping เขียนว่า "ออเดอร์ STB-… ได้รับการจัดส่งแล้ว" ตามด้วยขนส่งและหมายเลขพัสดุ พร้อมปุ่มคัดลอก

**โปรโมชั่น**
- หน้า Rules แสดงขั้น Discount เป็น Tag เช่น "1+ ชิ้น −5%", "3+ ชิ้น −10%"
- ฟอร์มมีตัวเลือก ใช้ร่วมกับโปรโมชั่นอื่นได้ (Stackable) / ใช้ได้เฉพาะโปรโมชั่นเดียว (Exclusive) ค่าเริ่มต้นเป็น Exclusive
- แจ้งลูกค้าทุกคนเมื่อประกาศโปร (บอกช่วงวันที่) และอีกครั้งเมื่อโปรเริ่ม ถ้าสองวันนี้ตรงกันแจ้งครั้งเดียว
- Order ทั้งออเดอร์ใช้ตัวเลือกเดียว: Exclusive 1 ตัว หรือ Stackable ทุกตัวรวมกัน สินค้าที่ตัวเลือกนั้นไม่คลุมจ่ายราคาปกติ ตะกร้าเลือกแบบที่คุ้มที่สุดกับทั้งออเดอร์ไว้ให้ ลูกค้าเปลี่ยนได้ครั้งเดียวสำหรับทั้งออเดอร์ ที่หน้า Cart (`/cart`) หรือในหน้าสินค้า (แก้ 2026-10-11 ตาม ADR 0004)
- ป้ายบนการ์ดแสดง Best Promotion
- โปรที่ลูกค้าใช้สิทธิ์ไม่ได้แล้วจะไม่แสดงและไม่ถูกใช้
- ตารางแจ้งเตือนมีคอลัมน์ promotion ที่ผูก FK

## User Stories

### หน้าร้าน
1. As a shopper, I want a shorter Hero, so that I can see products without scrolling past a large banner.
2. As a shopper on a phone, I want the Hero reduced proportionally, so that the first product row is visible on the first screen.

### Cart
3. As a Customer, I want the add-to-cart button to stop at the Available count, so that I never pick more than the shop can sell.
4. As a Customer, I want the quantity stepper in the Cart drawer and Cart page to stop at Available, so that I cannot raise it past what exists.
5. As a Customer, I want a clear message when I hit the Available limit, so that I understand why the number won't go up.
6. As a Customer, I want an out-of-stock product (Available 0) to be impossible to add, so that I don't build a Cart that can't be ordered.
7. As a Customer whose Cart was filled earlier, I want quantities lowered to the current Available when I open the Cart, with a note saying so, so that checkout does not fail.
8. As a Customer, I want to see the item subtotal before discounts, so that I can see how much the discount saves me.
9. As a Customer, I want the Cart summary to read subtotal → discount → Shipping Fee → total, so that I can follow the total.
10. As a Customer, I want to confirm before a product is removed from my Cart, so that a mis-tap does not lose my pick.
11. As a Customer, I want the same confirmation when I lower a quantity to zero, so that removing by stepper is as safe as the remove button.
12. As a Customer, I want my Cart emptied as soon as my Order is created, so that I cannot edit products that are already reserved for that Order.
13. As a Customer who left the Stripe page without paying, I want to resume payment from the Order page, so that an empty Cart does not lose my Order.
14. As a Customer, I want a failed Order creation to leave my Cart untouched, so that I can try again.

### Category และ Family
15. As an Admin, I want a Categories tab, so that I can manage the shop's Categories without a developer.
16. As an Admin, I want to add a Category with a Thai and English name, so that new kinds of goods can be listed.
17. As an Admin, I want to rename a Category, so that wording can be improved.
18. As an Admin, I want to reorder Categories, so that the filter chips appear in the order I choose.
19. As an Admin, I want to delete a Category that has no products, so that unused ones go away.
20. As an Admin, I want deleting a Category that still has products to be refused with a count of those products, so that no product is left without a Category.
21. As an Admin, I want the beetle Category to be renamable but never deletable, so that the live-beetle rules keep working.
22. As an Admin, I want each Category's link slug fixed at creation, so that shared `?category=` links keep working after a rename.
23. As an Admin, I want to manage the list of Families, so that the beetle filter shows exactly the groups I choose.
24. As an Admin, I want to pick a beetle's Family from my list in the product form, so that spelling variations don't split the filter.
25. As an Admin, I want deleting a Family still used by a product to be refused, so that beetles keep their Family.
26. As an Admin, I want existing Families typed on products to appear in the list automatically after the upgrade, so that I don't re-enter them.
27. As a shopper, I want the Category chips on the products page to follow the Admin's list and order in my language, so that the shop's grouping is what I see.
28. As a shopper, I want the Family filter to show only after choosing the beetle Category, as now, so that the filter stays simple.
29. As a Customer or guest, I want to be unable to reach the Categories admin screen or API, so that only Admins can change the catalogue structure.

### Stock
30. As an Admin, I want the stock adjust dialog to open showing the current On Hand, so that I type the counted number rather than a difference.
31. As an Admin, I want one adjust action instead of separate + and − buttons, so that setting stock is a single step.
32. As an Admin, I want setting On Hand below the units Reserved to be refused with the minimum shown, so that Available never goes negative.
33. As an Admin, I want an optional note when setting On Hand, so that the reason (delivery, recount, dead beetle) is kept.
34. As an Admin, I want the stock columns labelled คงคลัง and พร้อมขาย in Thai (On Hand / Available in English), so that the screen speaks my language.
35. As an Admin, I want a history icon after the edit icon on each product, so that I can open its Stock History.
36. As an Admin, I want Stock History to list every Stock Change newest first, so that I can see what happened recently.
37. As an Admin, I want each Stock Change to show its kind, time, who or what caused it, the Order Number if any, the note if any, and On Hand and Available after it, so that I can reconcile a count.
38. As an Admin, I want an entry when an Order is created (Available down), so that I can see which Order took a unit.
39. As an Admin, I want an entry when an Order is Cancelled (Available back), so that I can see stock returned by cancellation.
40. As an Admin, I want an entry when an Order is Confirmed (On Hand down), so that I can see when units left the shop's responsibility.
41. As an Admin, I want an entry when I or another Admin set On Hand, with their name, so that adjustments are accountable.
42. As an Admin, I want an entry when a product is created with its initial On Hand, so that history starts from the beginning for new products.
43. As an Admin, I want one opening entry per existing product recording On Hand and Available at the upgrade, so that history adds up from a known starting point.
44. As an Admin, I want Stock History paged, so that a busy product's history loads quickly.
45. As an Admin, I want Gift units to appear in Stock History like any order line, so that free goods are tracked too.

### Order confirmation and countdowns
46. As an Admin, I want a bell Notification when a Customer confirms receipt, so that I know the Order is finished.
47. As the Owner, I want a LINE message when a Customer confirms receipt, so that I know without opening the site.
48. As a Customer, I want a bell Notification when an Admin confirms receipt for me, so that I know my Order was closed.
49. As a Customer, I want a bell Notification when my Order is Confirmed automatically, so that the change does not surprise me.
50. As an Admin, I want a bell Notification when an Order is Confirmed automatically, so that I see Revenue land.
51. As an Admin, I don't want a LINE message for automatic confirmations, so that LINE stays for things a person did.
52. As an Admin, I want each Awaiting Payment Order in the list to count down to when its Reservation ends, so that I know when the units return.
53. As an Admin, I want each Shipping Order in the list to count down to its automatic Confirmed time, so that I know when it closes on its own.
54. As an Admin, I want a countdown to turn to a warning colour when under 1 hour (payment) or 1 day (auto confirm), so that urgent Orders stand out.
55. As an Admin, I want the countdown to tick live without reloading, so that the number is current.
56. As an Admin, I want an expired countdown to read "หมดเวลา / processing" until the background job moves the Order, so that the list never shows a negative time.

### Shipping notification
57. As a Customer, I want the Shipping Notification to read "ออเดอร์ STB-… ได้รับการจัดส่งแล้ว", so that I instantly know which Order shipped.
58. As a Customer, I want the carrier and Tracking Number in the Notification, so that I can track the parcel.
59. As a Customer, I want a copy button for the Tracking Number, so that I can paste it into the carrier's site.

### Promotions: Rules screen
60. As an Admin, I want each Discount Tier shown as a tag like "3+ ชิ้น −10%", so that a Promotion's ladder reads at a glance.
61. As an Admin, I want tags in ascending order of units, so that the ladder reads from first step to last.
62. As an Admin, I want Gift shown as its own tag (e.g. "ซื้อ 3 แถม 1"), so that discounts and gifts are distinguishable.
63. As an Admin, I want a Stackable / Exclusive choice on every Promotion, so that I control which offers combine.
64. As an Admin, I want new Promotions to default to Exclusive, so that offers never combine by accident.
65. As an Admin, I want existing Promotions treated as Exclusive after the upgrade, so that current behaviour is unchanged.
66. As an Admin, I want the Stackable / Exclusive choice shown on each Promotion in the list as a tag, so that I can see how each one behaves.
67. As an Admin, I want the Stackable / Exclusive choice locked from the start date once redeemed, like the other benefit fields, so that customers' orders stay explainable.

### Promotions: announcements
68. As a Customer, I want a Notification when a new Promotion is announced, saying its date range, so that I can plan to buy.
69. As a Customer, I want a second Notification when the Promotion starts, so that I know I can use it now.
70. As a Customer, I want only one Notification when a Promotion is created on (or after) its start day, so that I'm not notified twice in one day.
71. As an Admin, I want a Promotion created switched off to be announced when I first switch it on, so that customers aren't told about an offer I'm still preparing.
72. As an Admin, I want date edits after announcement not to send another Notification, so that customers aren't spammed.
73. As a Customer, I want tapping a Promotion Notification to show the products it covers, so that I can act on it.
74. As a deactivated Member, I want no Promotion Notifications, so that a closed account stays quiet.

### Promotions: pricing and choice
75. As a Customer, I want every Stackable Promotion covering a product applied together when my Order uses the Stackable option, so that I get all offers the shop allows to combine.
76. As a Customer, I want stacked percentage Discounts applied one after another to the reduced price, so that the result is predictable.
77. As a Customer, I want a unit price never to go below zero, so that stacked baht Discounts can't make the shop pay me.
78. As a Customer, I want the Cart to pre-select the option worth most to my whole Order (Gifts counted at their price), so that I get the best deal without thinking.
79. As a Customer, I want to choose another option once for the whole Order (each Exclusive Promotion, or the Stackable set) on the Cart page or a product page, so that I can pick a Gift I prefer over a Discount. Products the option does not cover pay the normal price.
80. As a Customer, I want the option cards shown only when my Order has more than one option, so that simple Carts stay simple.
81. As a Customer, I want each option card to show how much it saves or what it gives, so that I can compare.
82. As a Customer, I want my choice remembered with my Cart and honoured at checkout, so that the price I saw is the price I pay.
83. As a Customer, I want the server to re-check my choice at checkout and fall back to the best option if it is no longer valid, so that an expired Promotion can't break my Order.
84. As a Customer, I want every Gift of every applied Promotion, so that stacked Gifts are honoured.
85. As a Customer, I want one Redemption counted per Promotion my Order uses, so that caps are fair however many lines share it.
86. As a Customer, I want a Promotion I can no longer redeem to drop out of a stack while the others still apply, so that I keep what I'm still entitled to.

### Promotions: card badge
87. As a shopper, I want the card badge to show the Best Promotion for that product, so that I see the most attractive offer.
88. As a shopper, I want "best" judged on buying one unit, so that the badge reflects buying a one-of-a-kind beetle.
89. As a shopper, I want the lowest tier compared when no Promotion gives anything for one unit, so that "buy N" offers still compete.
90. As a shopper, I want a Gift compared by the gift's value shared over the units it takes, so that gifts and discounts compete fairly.
91. As a Customer who has used up a Promotion, I want its badge hidden for me, so that I'm not shown an offer I can't get.
92. As any shopper, I want a Promotion that has reached its Customer cap hidden unless I already redeemed it within my own cap, so that full offers disappear.

### Notifications table
93. As a developer, I want Promotion Notifications to reference their Promotion by a foreign key, so that the link is enforced by the database.
94. As a developer, I want existing Promotion Notifications back-filled from their JSON data, so that nothing is lost.
95. As an Admin, I want deleting a never-redeemed Promotion to remove its Notifications, so that customers don't tap through to nothing.

## Implementation Decisions

### Migration 006 (ใหม่, ต่อจาก 005, รันซ้ำได้)
- **ตาราง `categories`:** slug (PK, เปลี่ยนไม่ได้), name_th, name_en, sort_order, is_system
  - seed 4 แถวเดิม `beetle` ตั้ง is_system = true
  - ลบ CHECK constraint ของ `products.category` ออก แล้วเปลี่ยนเป็น FK ไป `categories(slug)` ON DELETE RESTRICT
  - trigger กันไม่ให้ลบแถวที่ is_system
- **ตาราง `beetle_families`:** id, name, sort_order
  - seed จาก `products.attributes->>'family'` ที่ไม่ซ้ำกัน
  - attributes.family ของสินค้ายังเก็บเป็นข้อความเหมือนเดิม การลบถูกกันที่ service โดยนับสินค้าที่ใช้ family นั้นก่อน ไม่ใช้ FK เพราะ family อยู่ใน JSONB
- **`promotions.stacking`:** TEXT NOT NULL DEFAULT 'exclusive' CHECK IN ('stackable','exclusive') โปรเดิมจึงเป็น exclusive ทั้งหมด และเพิ่ม stacking เข้าไปในชุด field ที่ถูกล็อกหลัง redeem
- **`promotions` announce:** มีคอลัมน์ `announced_at` อยู่แล้ว ใช้หมายถึง "ส่งแจ้งเริ่มโปรแล้ว" เพิ่ม `previewed_at` สำหรับ "ส่งแจ้งประกาศโปรใหม่แล้ว"
- **ตาราง `notifications`:**
  - เพิ่ม `promotion_id` UUID FK ไป promotions ON DELETE CASCADE และ back-fill จาก `data->>'promotion_id'`
  - เพิ่ม unique index ที่ (user_id, promotion_id, type) WHERE promotion_id IS NOT NULL เพื่อให้แจ้งได้ครั้งเดียว
  - เพิ่ม type ใหม่: `promotion_new`, `confirmed`, `confirmed_auto`, `order_confirmed_admin` (ตัวสุดท้ายส่งเข้ากระดิ่ง Admin)
  - type `promotion` เดิมยังใช้สำหรับ "โปรเริ่มแล้ว"
  - ปรับ unique index ของ order notifications ให้มี user_id ด้วย เพราะ Admin หลายคนได้แจ้งเตือนของ order เดียวกัน
- **ตาราง `stock_changes`:** id, product_id FK, kind ('opening','created','set_on_hand','order_created','order_cancelled','order_confirmed'), on_hand_delta, available_delta, on_hand_after, available_after, order_id (nullable FK), actor_id (nullable, คือ Admin ที่ทำรายการ), note, created_at
  - Admin อ่านได้อย่างเดียวผ่าน backend ไม่มี RLS grant ให้ client
  - insert แถว `opening` ให้ทุกสินค้าที่มีอยู่ตอน migrate
- **DB functions ที่ต้องเขียนแถว `stock_changes` ใน transaction เดียวกับที่เปลี่ยนตัวเลข:** create-order (ทุก order line รวมของแถม), cancel, confirm และ adjust On Hand
  - ฟังก์ชัน adjust เปลี่ยนจากรับ delta เป็นรับ target On Hand + note + actor และ refuse ถ้า target < On Hand − Available (จำนวนที่ Reserved)
  - ทุกทางที่สร้างสินค้าต้องเขียนแถว `created` ด้วย
- **Trigger แจ้งเตือนเมื่อ Confirmed:** ขยาย trigger order notify ให้ทำงานเมื่อ status เป็น confirmed
  - confirmed_by = 'customer' → แจ้ง Admin ทุกคนที่ยังไม่ถูก deactivate
  - confirmed_by = 'admin' → แจ้งลูกค้า
  - confirmed_by = 'auto' → แจ้งทั้งลูกค้าและ Admin
- **Job ประกาศโปร:** ขยายเป็น 2 ขั้น ทำงานกับโปรที่ is_active และยังไม่หมดเวลา
  1. `previewed_at` ยังว่าง: ถ้าวันที่ไทยของวันนี้ ≥ วันเริ่ม ส่ง type `promotion` (โปรเริ่มแล้ว) ครั้งเดียว แล้วตั้งทั้ง previewed_at และ announced_at ถ้ายังไม่ถึงวันเริ่ม ส่ง `promotion_new` พร้อม starts_at/ends_at แล้วตั้ง previewed_at
  2. previewed_at มีค่าแล้วแต่ announced_at ยังว่าง และถึงเวลาเริ่มแล้ว: ส่ง `promotion` แล้วตั้ง announced_at
  - backend เรียก job นี้ทันทีหลังสร้างโปรหรือเปิดโปร (ไม่ต้องรอรอบ interval) และยังเรียกตามรอบ interval เดิมด้วย

### Backend
- **Categories API** (ภายใต้ admin):
  - list (public read ได้ ใช้แสดงชิปหน้าร้าน), create, update (ชื่อ, ลำดับ), delete
  - delete คืน 409 พร้อมจำนวนสินค้า หรือคืน 409 ถ้าเป็นหมวดระบบ
  - slug สร้างจาก name_en (เป็น lowercase, ช่องว่างเป็น `-`) ถ้าชนกับที่มีอยู่จะเติมเลขต่อท้าย
- **Families API:** list (public), create, rename (rename ต้องอัปเดต attributes.family ของสินค้าที่ใช้ชื่อนั้นด้วย), delete (409 ถ้ายังมีสินค้าใช้)
- **Product validation:** category ต้องมีอยู่ใน `categories` และ family (ถ้าเป็นด้วง) ต้องมีอยู่ใน `beetle_families`
- **Stock API:**
  - `POST /products/:id/stock` เปลี่ยน body เป็น `{ on_hand, note? }` และคืน product ที่อัปเดตแล้ว
  - เพิ่ม `GET /products/:id/stock-history?page=` (เฉพาะ Admin) คืน Stock Change พร้อม Order Number และชื่อผู้ทำรายการ
- **Pricing module (seam หลัก):** เปลี่ยน "choice" จาก promotion id ต่อ line เป็น option เดียวของทั้ง Order (`priceCart({ promotionChoice })`) ซึ่งมี 2 แบบ: `{ kind: 'exclusive', promotion_id }` หรือ `{ kind: 'stack' }` (แก้ 2026-10-11: เดิมเป็นต่อ line)
  - **options ของ Order:** Exclusive แต่ละตัวที่คลุมสินค้าอย่างน้อย 1 ตัวในตะกร้าและลูกค้ายังใช้สิทธิ์ได้ บวกชุด stack 1 ชุด (ถ้ามี Stackable อย่างน้อย 1 ตัว) สินค้าที่ option ไม่คลุมคิดราคาปกติ
  - **การคิด stack:** แต่ละ Stackable ยังนับ tier จากจำนวนหน่วยรวมของสินค้าทุกตัวที่โปรนั้นคลุม เหมือนเดิม ส่วนลดเปอร์เซ็นต์คูณต่อกัน เรียงลำดับคงที่ตาม promotion id เพื่อให้ผลไม่ขึ้นกับลำดับ ส่วนลดบาทหักทีหลัง ราคาต่อหน่วยไม่ต่ำกว่า 0 และของแถมของทุกโปรได้ครบ
  - **ผลลัพธ์:** `promotion_options` (ทุก option ของ Order พร้อมมูลค่าที่ประหยัด / ของแถม และ option ที่ดีที่สุด) และ `promotion_option` (option ที่ใช้จริง)
  - **Redemption:** order-create บันทึกหนึ่งแถวต่อโปรที่ order ใช้จริง
  - price-preview และ checkout ส่ง `promotion_choice` ของ Order มา server validate ใหม่ ถ้าไม่ได้เลือกหรือใช้ไม่ได้แล้วให้ใช้ option ที่ดีที่สุดแทน
- **Best Promotion helper:** ฟังก์ชัน pure ที่รับสินค้า 1 ตัวกับรายการโปรที่ใช้ได้ แล้วคืนโปรที่ดีที่สุดตามนิยามใน glossary
  - มูลค่าต่อ 1 หน่วยที่ราคาสินค้านั้น ถ้าไม่มีโปรไหนให้อะไรเลยตอนซื้อ 1 หน่วย ใช้ tier ต่ำสุดของแต่ละโปร
  - ของแถมคิดเป็น ราคาของแถม × gift_quantity / gift_every โดยใช้ของแถมราคาต่ำสุดถ้ามีหลายตัว
  - frontend ใช้ helper ตัวเดียวกันนี้ (ย้ายไปอยู่ใน frontend lib แบบ mirror พร้อมเทสต์ของตัวเอง)
- **`GET /rules/promotions`:**
  - ถ้ามี token ของลูกค้า ตัดโปรที่ลูกค้าคนนั้นใช้สิทธิ์ครบแล้วออก ใช้ `blockedReason` เดิม
  - ทุกคนจะไม่เห็นโปรที่ครบจำนวน Customer cap แล้ว ยกเว้นลูกค้าที่เคย redeem และยังไม่ครบ cap ของตัวเอง
  - เพิ่ม field `stacking` และราคาของแถม เพื่อให้ frontend คิด Best Promotion ได้
- **LINE:** เพิ่มข้อความ "ลูกค้ายืนยันรับสินค้าแล้ว" (Order Number, ชื่อลูกค้า, ยอด) ส่งเฉพาะตอน confirmed_by = 'customer' ไปยังผู้รับตาม ADR 0002 ส่งจาก route confirm ของลูกค้าหลังจาก DB commit แล้ว ถ้า LINE ส่งไม่สำเร็จให้ log ไว้ ไม่ทำให้ request ล้ม
- **Order list API (Admin):** คืน `expires_at` (Awaiting Payment) และ `auto_confirm_at` = shipped_at + จำนวนวันยืนยันอัตโนมัติ (Shipping) ตัวเลขวันมาจาก config เดียวกับที่ job ใช้ เพื่อให้ไม่คลาดกัน

### Frontend
- **ShopHero:** ลดความสูงทุก breakpoint ลง 30% รวมทั้ง min-height และ aspect
- **CartContext:**
  - `addItem` และ `updateQuantity` จำกัดที่ Available ทุกทาง รวมถึงตอนใส่ของครั้งแรก (ถ้า Available 0 จะไม่เพิ่ม)
  - ตอนเปิด Cart ให้ re-sync กับ Available ล่าสุด ลดจำนวนลง และแจ้งลูกค้า
  - ทุกทางที่ addItem ต้องส่ง Available มาด้วย จุดนี้คือ root cause ของข้อ 3 ที่ต้องหาให้เจอ
- **Cart page / drawer:**
  - เพิ่มบรรทัด "ราคาสินค้ารวม" และลำดับบรรทัด summary ตามที่ตกลง
  - ใช้ SweetAlert ยืนยันเมื่อลบ หรือเมื่อลดจำนวนจาก 1 ลงไปเป็น 0
  - drawer เป็นค่าเริ่มต้น มีไอคอนขยายไปหน้า Cart (`/cart`) ซึ่งแสดงการ์ดตัวเลือกโปรของทั้ง Order (เมื่อมีมากกว่า 1 option) หน้าสินค้าก็แสดงการ์ดชุดเดียวกัน
- **Checkout:** ล้าง Cart ทันทีหลัง API สร้าง Order สำเร็จ ก่อน redirect ไป Stripe แล้วเอาการล้างตอน `justPaid` ใน Order Detail ออก ถ้าสร้าง Order ไม่สำเร็จ Cart ต้องไม่ถูกแตะ
- **Admin แท็บ Categories ใหม่:** มีสองส่วน: Category (ตาราง, ชื่อ TH/EN, ปุ่มเลื่อนขึ้น/ลง, แก้, ลบ ซึ่งปิดไว้สำหรับ beetle) และ Family ใช้ SweetAlert ยืนยันการลบ และแสดง error 409 เป็นภาษาคน
- **Products page:** ชิป Category มาจาก API ตามลำดับและภาษา ฟอร์มสินค้าเลือก Category และ Family จาก dropdown
- **AdminProducts:**
  - ปุ่ม +/− เปลี่ยนเป็นปุ่มเดียว เปิด SweetAlert ที่มีช่อง number เติม On Hand ปัจจุบันไว้ (min = จำนวนที่ Reserved) กับช่องหมายเหตุ
  - ไอคอน history ต่อจาก edit เปิด modal Stock History แบบแบ่งหน้า
  - label ไทยเป็น คงคลัง / พร้อมขาย
- **AdminOrders:** ใช้ hook countdown ตัวเดียว (tick ทุก 1 วินาทีเมื่อเหลือน้อยกว่า 1 ชม. ไม่อย่างนั้น tick ทุก 1 นาที) แสดงใน cell สถานะ เป็นสีเตือนตาม threshold ถ้าหมดเวลาแล้วแสดง "กำลังดำเนินการ"
- **NotificationBell:**
  - แจ้ง Shipping ใช้หัวข้อตามที่กำหนด บรรทัดรองเป็นขนส่ง · หมายเลขพัสดุ พร้อมปุ่มคัดลอก
  - render type ใหม่ทั้ง 4 (`promotion_new` แสดงช่วงวันที่เป็นวันที่ไทย)
  - แจ้งโปรลิงก์ไปหน้าสินค้าที่กรองตามโปรนั้น
- **PromotionsEditor / AdminRules:** แสดง tier เป็น chip และของแถมเป็น chip แยก มี radio Stackable / Exclusive พร้อมคำอธิบายสั้นๆ และในรายการโปรแสดง tag stacking
- **ProductCard:** ป้ายโปรใช้ Best Promotion helper

### i18n
- ข้อความใหม่ทุกข้อความต้องมีทั้ง TH และ EN
- locale test ที่มีอยู่ต้องผ่าน คือ key ของ TH และ EN ต้องตรงกัน

## Testing Decisions

- **เทสต์ที่ดี:** ทดสอบพฤติกรรมที่มองเห็นจากภายนอกผ่าน seam สูงสุดที่มี ได้แก่ แถวใน DB, ผลจาก API และข้อความที่ render ไม่ทดสอบ helper ภายใน, รูปร่างของ query หรือ state ภายในของ component
- **DB seam** (PGlite, prior art คือ migration test เดิม):
  - migration 006 รันต่อจาก 001–005 ได้ และรันซ้ำได้
  - seed categories / families และ back-fill notifications.promotion_id
  - ลบหมวดระบบหรือหมวดที่มีสินค้าไม่ได้
  - stock_changes: แถว opening, และ create / cancel / confirm / set-on-hand ให้ delta และยอด after ถูกต้อง
  - set ต่ำกว่าจำนวน Reserved ถูกปฏิเสธ
  - แจ้งเตือน Confirmed ไปถึงผู้รับที่ถูกต้องตาม confirmed_by
  - job ประกาศโปรครบทุกกรณี: ประกาศล่วงหน้าแล้วแจ้งตอนเริ่ม, สร้างวันเดียวกันได้แจ้งครั้งเดียว, สร้างแบบปิดไว้ไม่แจ้ง, เรียกซ้ำไม่แจ้งซ้ำ
  - Redemption: นับหนึ่งแถวต่อโปรที่ใช้ เมื่อมี stack
- **Pricing module seam** (node:test, prior art คือ pricing / promotionPricing / giftPricing tests):
  - options ของ Order และสินค้าที่ option ไม่คลุมจ่ายราคาปกติ
  - คิด stack: เปอร์เซ็นต์ทบ, บาท, ราคาไม่ต่ำกว่า 0, ของแถมหลายโปร
  - เลือก option ที่ดีที่สุด และ fallback เมื่อ option ใช้ไม่ได้
  - โปรที่ใช้สิทธิ์ครบหลุดออกจาก stack
  - Best Promotion helper ทุกกรณีตามนิยาม
- **Routes seam** (prior art คือ routes.test.js):
  - Categories / Families: ตรวจสิทธิ์ Admin และ 409
  - stock set / history
  - `/rules/promotions` กรองตามสิทธิ์ของลูกค้า
  - LINE ถูกเรียกเฉพาะตอนลูกค้า confirm
- **Frontend page seam** (RTL ผ่าน harness renderPage, prior art คือ Checkout / OrderDetail / Promotions / NotificationBell / AdminDashboard tests):
  - Cart จำกัดที่ Available, ยืนยันก่อนลบ, ลำดับบรรทัด summary, การ์ดตัวเลือกโปรของ Order
  - Checkout ล้าง Cart เมื่อสร้าง Order สำเร็จเท่านั้น
  - แท็บ Categories
  - popup stock เติมค่าปัจจุบัน และ modal history
  - countdown ใน AdminOrders (ใช้ fake timers)
  - ข้อความแจ้งเตือนทุก type
  - ป้ายบนการ์ดแสดง Best Promotion
  - Hero ไม่ต้องมีเทสต์ ตรวจด้วยตาในเบราว์เซอร์

## Out of Scope

- Category ที่มีกฎแบบ "สัตว์มีชีวิต" นอกจาก beetle (ADR 0005)
- Promotion ที่คลุมสินค้าตาม Category (ยังเลือกเป็นรายสินค้าหรือทั้งหมดเหมือนเดิม)
- แสดง countdown ให้ฝั่งลูกค้า
- ส่ง LINE ให้ลูกค้า (LINE ยังส่งเฉพาะ Owner / target ตาม ADR 0002)
- Export Stock History เป็นไฟล์
- ประวัติสต็อกก่อนวันที่รัน migration 006 (เริ่มจากแถว opening)

## Further Notes

- **ข้อ 3 (เพิ่มลงตะกร้าเกิน Available) เป็นบั๊ก:** `addItem` มี clamp อยู่แล้วแต่ยังเกินได้ ให้ไล่หาทุกจุดที่เรียก addItem / updateQuantity และดูว่าทางไหนไม่ส่ง Available มา ควรใช้ diagnosing-bugs และเขียนเทสต์ที่ fail ก่อนแก้
- **ข้อ 11:** trigger ใส่ carrier และ tracking_number ไว้ใน data แล้ว งานนี้เป็นงานฝั่ง UI เท่านั้น
- **คำศัพท์:** ห้ามใช้คำว่า "Stockmove" บนหน้าจออีก (ดู glossary: Available, Stock Change)
- **ห้ามแก้ migration 001–005:** ทุกการเปลี่ยนแปลง schema และ function ต้องอยู่ใน migration 006
