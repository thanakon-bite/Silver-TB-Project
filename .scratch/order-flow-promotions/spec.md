# Spec: Order Status ใหม่, On Hand / Available, Notification, Rules (ค่าส่ง + Promotion) และปรับหน้าร้าน

**Label:** ready-for-agent
**Branch:** fix/checkout-polish (ห้าม commit / push ให้เจ้าของ repo ทำเอง)
**อ้างอิง:** `CONTEXT.md` (glossary ฉบับปรับแล้ว), ADR 0001 (Stripe-hosted Checkout), ADR 0002 (LINE target จาก env), ADR 0003 (On Hand ลดตอน Confirmed), `design.md`

## Problem Statement

ร้านขายด้วงมีชีวิตและอุปกรณ์เลี้ยง ตอนนี้ใช้ Order Status สองช่อง (status + payment status) ที่ไม่ตรงกับวิธีทำงานจริงของร้าน:

- แอดมินไม่รู้ว่าออเดอร์ไหนลูกค้าได้รับของแล้วจริงๆ และการ์ด "จ่ายเงิน/รอส่ง" ใน Overview ไม่ได้บอกยอดเงินที่ร้านได้จริง
- สต็อกมีตัวเลขเดียว แยกไม่ออกว่าของที่อยู่ในความรับผิดชอบของร้านมีเท่าไหร่ และที่ยังขายได้มีเท่าไหร่
- แอดมินยกเลิกออเดอร์ที่ลูกค้าจ่ายเงินแล้วไม่ได้ ถ้าจะยกเลิกต้องไปคืนเงินแยกต่างหาก และลูกค้าไม่รู้ว่าออเดอร์ถูกยกเลิกเพราะอะไร
- ลูกค้าไม่มีทางรู้ว่าสถานะออเดอร์เปลี่ยน ถ้าไม่เปิดหน้าออเดอร์เอง
- ค่าส่งเป็นค่าคงที่ใน env และร้านทำโปรโมชันไม่ได้เลย
- หน้าร้านยังจืด: Hero มีภาพเดียว หัวข้อ "เลือกซื้อสินค้า" กับช่องค้นหากินพื้นที่และไม่เข้ากับ Hero หน้าเกี่ยวกับเราจัด layout แปลกตา รายการโปรดปนอยู่กับสินค้าอื่น
- สลับภาษาแล้วยังมีข้อความหลงภาษาอยู่หลายหน้า
- แอดมินเพิ่มหรือลบ Member จากหน้าแอดมินไม่ได้ ในหน้าสต็อก สวิตช์ active ล้นกรอบ และการตั้ง bestseller ทำได้ยาก

## Solution

- **Order Status ช่องเดียว:** Awaiting Payment → Paid → Waiting Shipping → Shipping → Confirmed หรือ Cancelled ตอนนี้ Paid จะไป Waiting Shipping ทันที (เมื่อมีการแจ้ง LINE OA ค่อยแยกขั้นนี้ออก) แอดมินเปลี่ยนเป็น Shipping พร้อมเลขพัสดุ ลูกค้ากด "ได้รับสินค้าแล้ว" หรือแอดมินกดแทน ถ้าไม่มีใครกด ระบบ Confirmed ให้เองเมื่อครบ 7 วันหลัง Shipping
- **ยกเลิกพร้อม Cancel Reason:** แอดมินยกเลิกได้ตอน Awaiting Payment, Paid และ Waiting Shipping ต้องกรอก Reason และถ้าลูกค้าจ่ายแล้วระบบคืนเงินเต็มจำนวนผ่าน Stripe ในขั้นตอนเดียวกัน ลูกค้ายกเลิกเองได้เฉพาะตอน Awaiting Payment ออเดอร์ที่หมดเวลาจ่าย ระบบยกเลิกให้พร้อม Reason "หมดเวลาชำระเงิน"
- **สต็อกสองตัวเลข:** On Hand (หน้าแอดมิน label ว่า Onhand) และ Available (label ว่า Stockmove เป็นตัวเลขที่ลูกค้าเห็น) พร้อม In Transit
- **กระดิ่ง Notification:** อยู่ข้างปุ่มสลับธีม แสดงเมื่อล็อกอินแล้ว
- **หน้า Rules ของแอดมิน:** Shipping Rule และ Promotion ราคาที่เห็นในหน้าสินค้า ตะกร้า หน้าชำระเงิน และ Stripe มาจากตัวคำนวณตัวเดียวกัน
- **ปรับหน้าร้าน:** Hero 4 สไลด์สลับอัตโนมัติ, แถบเครื่องมือเดียวต่อจาก Hero, รายการโปรดขึ้นก่อน, หน้าเกี่ยวกับเราจัดซ้าย-ขวาพร้อมไอคอนและภาพด้วง
- **ภาษา:** แปล TH/EN ครบทุกหน้า
- **ลืมรหัสผ่าน:** ทดสอบ flow และเขียนคู่มือตั้ง SMTP

## User Stories

### Order Status และการติดตาม

1. As a Customer, I want my order to show one clear status (รอชำระเงิน / ชำระแล้ว / รอจัดส่ง / จัดส่งแล้ว / ได้รับสินค้าแล้ว / ยกเลิกแล้ว), so that I always know where my order is
2. As a Customer, I want the order timeline to start with "สั่งซื้อ" and mark each later status with its time, so that I can see the history of my order
3. As a Customer, I want my order to move to รอจัดส่ง as soon as my payment is confirmed, so that I know the shop is packing it
4. As a Customer, I want to see the Tracking Number once my order is Shipping, so that I can follow the parcel with the carrier
5. As a Customer, I want a "ได้รับสินค้าแล้ว" button on a Shipping order, so that I can tell the shop my parcel arrived
6. As a Customer, I want my order to be Confirmed automatically 7 days after Shipping if I forget, so that the order does not stay open forever
7. As a Customer, I want to cancel my own order while it is Awaiting Payment, so that I can change my mind before paying
8. As a Customer, I want to see why my order was cancelled, so that I understand what went wrong
9. As a Customer, I want a cancelled paid order to show ยกเลิกและคืนเงินแล้ว, so that I know my money is coming back
10. As a Customer, I want my order list to use the same statuses and colours as the order detail page, so that the two pages never disagree
11. As an Admin, I want orders to use the same statuses everywhere (order list, Overview, customer pages), so that the shop and customers speak the same language
12. As an Admin, I want no separate payment status column, so that one status tells me everything
13. As an Admin, I want to move a Waiting Shipping order to Shipping only after entering a Tracking Number, so that every shipped order can be traced
14. As an Admin, I want to confirm a Shipping order on the customer's behalf, so that I can close orders I know were delivered
15. As an Admin, I want status changes to allow only the next legal step, so that I cannot skip or reverse a status by mistake
16. As an Admin, I want to never be able to mark an order Paid by hand, so that only Stripe can confirm payment (ADR 0001)
17. As an Admin, I want existing orders to be converted to the new statuses when the migration runs, so that history is not lost

### ยกเลิกออเดอร์โดยแอดมิน

18. As an Admin, I want a Cancel button on orders that are Awaiting Payment, Paid or Waiting Shipping, so that I can stop orders I cannot fulfil
19. As an Admin, I want the Cancel dialog to require a Cancel Reason before it lets me confirm, so that the customer is always told why
20. As an Admin, I want cancelling a paid order to refund it in full through Stripe in the same step, so that I don't have to refund separately
21. As an Admin, I want to be told clearly if the Stripe refund fails, with the order left uncancelled, so that money and status never get out of sync
22. As an Admin, I want no Cancel button on Shipping or Confirmed orders, so that after-sale refunds stay a deliberate manual process
23. As a Customer, I want reserved units of a cancelled order to return to Available, so that other shoppers can buy them

### สต็อก On Hand / Available

24. As a shopper, I want the stock number I see to be Available, so that I never order something already taken
25. As a Customer, I want units to be held for me the moment my order is created, so that a one-of-a-kind beetle is not sold to two people
26. As an Admin, I want to see On Hand, Available and In Transit side by side for every product, so that I can reconcile a physical count
27. As an Admin, I want receiving stock to add to both On Hand and Available, so that new stock becomes sellable immediately
28. As an Admin, I want On Hand to drop only when an order is Confirmed, so that beetles in transit still count as the shop's responsibility (ADR 0003)
29. As an Admin, I want Available to return when any order is cancelled (by customer, Admin or expiry), so that stock never leaks
30. As an Admin, I want stock adjustments that would make On Hand or Available negative to be refused, so that numbers stay valid
31. As an Admin, I want existing products to get On Hand = current stock + units in open orders and Available = current stock when the migration runs, so that the numbers are right from day one

### หน้าสต็อกและหน้าออเดอร์ของแอดมิน

32. As an Admin, I want the active/inactive switch on each product row to sit fully inside its cell, so that the table looks correct
33. As an Admin, I want a star button on each product row to toggle Best Seller, so that I can set it without opening the edit form
34. As an Admin, I want an Admin Note column on the orders table, so that I can see my own notes at a glance
35. As an Admin, I want to edit the Admin Note from the orders screen, so that I can keep notes current
36. As an Admin, I want to filter the orders table by the new statuses, so that I can find what needs action

### Overview

37. As an Admin, I want a card showing how many orders are Confirmed, so that I know how many orders truly completed
38. As an Admin, I want a Revenue card that sums only Confirmed orders (after discounts, including Shipping Fees), so that I see the money the shop actually earned
39. As an Admin, I want a card showing the count of orders in each of the six statuses, so that I can see the whole pipeline
40. As an Admin, I want the old Paid / waiting-to-ship cards removed, so that the Overview isn't misleading

### Notification

41. As a signed-in Member, I want a bell next to the theme switch, so that I can see my notifications from any page
42. As a guest, I want no bell, so that the header stays simple
43. As a Customer, I want a notification when my order is Awaiting Payment, so that I remember to pay
44. As a Customer, I want a notification when my order goes Shipping, including the Tracking Number, so that I know it's on its way
45. As a Customer, I want a notification 3 days after Shipping asking me to confirm receipt if I haven't, so that I remember to confirm
46. As a Customer, I want a notification when my order is Cancelled, including the Cancel Reason, so that I learn about it immediately
47. As a Customer, I want a notification when a new Promotion starts, so that I don't miss deals
48. As a Member, I want an unread count on the bell, so that I know when something is new
49. As a Member, I want clicking a notification to mark it read and take me to the related order (or the products page for a Promotion), so that I can act on it
50. As a Member, I want a "อ่านทั้งหมด" action, so that I can clear the count at once
51. As a Member, I want the bell to pick up new notifications within about a minute without reloading, so that it feels live
52. As a Member, I want notification text in my current language, so that Thai and English readers both understand it
53. As a Member, I want to see only my own notifications, so that my orders stay private

### Shipping Rule

54. As an Admin, I want a Rules page with a Shipping Rule section, so that I can set delivery charges myself instead of editing env
55. As an Admin, I want to define Shipping Tiers by number of paid units (e.g. 1 unit = 10 baht, 2–5 units = 50 baht, 6+ = 80 baht), so that the fee matches parcel size
56. As an Admin, I want the tiers to be checked on save for gaps, overlaps and a missing open-ended last tier, so that every order gets exactly one fee
57. As an Admin, I want to add and remove tiers freely, so that I can change pricing over time
58. As an Admin, I want an optional Free Shipping Threshold (item total after discounts), so that I can reward bigger orders
59. As a Customer, I want Gift units not to count towards the Shipping Fee, so that a free gift never costs me shipping
60. As a Customer, I want to see the Shipping Fee in the Cart before checkout, so that there are no surprises
61. As a Customer, I want the Shipping Fee on my order to stay as it was at checkout, so that later rule changes don't alter my order

### Promotion: การตั้งค่า

62. As an Admin, I want to create as many Promotions as I need, so that I can run several campaigns
63. As an Admin, I want to give each Promotion a Thai name and an optional English name, so that both languages show something sensible
64. As an Admin, I want to set a start and end date (Thai time, both days included), so that the Promotion runs exactly when I intend
65. As an Admin, I want to choose whether a Promotion covers all products or a ticked list, so that I can target specific items
66. As an Admin, I want a Promotion to have a Discount, a Gift, or both, so that I can design different offers
67. As an Admin, I want to set Discount Tiers like "buy 1 get 3% off, buy 5 get 10% off", in percent or baht per unit, so that bigger purchases get bigger discounts
68. As an Admin, I want to set a Gift as "every X paid units earn Y free units" and tick which products can be given, so that I control what goes out free
69. As an Admin, I want to pick gift products even if they are not for sale, so that I can give stickers or samples
70. As an Admin, I want to cap Redemptions per Customer, or leave it unlimited, so that one person can't overuse a deal
71. As an Admin, I want to cap how many different Customers may redeem a Promotion, or leave it unlimited, so that I can run "first 50 customers" offers
72. As an Admin, I want to edit name, end date and on/off at any time, but coverage, tiers, gifts and caps only before the start date, so that customers who already redeemed are treated fairly
73. As an Admin, I want to delete a Promotion only if nobody has redeemed it, and end it otherwise, so that past orders still refer to it
74. As an Admin, I want to see how many Redemptions and distinct Customers each Promotion has, so that I can judge it

### Promotion: หน้าร้าน ตะกร้า และหน้าชำระเงิน

75. As a shopper, I want a short badge on product cards in a Promotion (e.g. "ซื้อ 3 ลด 5%", "ซื้อ 2 แถม 1"), so that I notice deals while browsing
76. As a shopper, I want the product detail page to list every tier of its Promotion, so that I know how to get the best price
77. As a Customer, I want the Cart to show each line's discount and any Gift as separate lines, so that I see exactly what I'm getting
78. As a Customer, I want the Cart to tell me how many more units unlock the next tier (e.g. "เพิ่มอีก 1 ชิ้น ลด 5%"), so that I can decide to buy more
79. As a Customer, I want to choose which gift product I get when several are offered, so that I receive the one I prefer
80. As a Customer, I want the Cart to say "ของแถมหมด" and still let me order when no gift is Available, so that a missing gift doesn't block my purchase
81. As a Customer, I want the best Promotion applied automatically to each line without entering a code, so that I always get the best deal
82. As a Customer, I want units of different products in the same Promotion to count together towards a tier, so that mixing items still earns the discount
83. As a Customer, I want Checkout and the Stripe page to show the same total as the Cart, so that I trust the price
84. As a Customer, I want my order detail to show discounts, gifts and Shipping Fee as separate lines, so that my receipt is clear
85. As a Customer, I want my Redemption to be returned if my order is cancelled, so that I can still use the Promotion later
86. As a Customer who has reached a Promotion's limit, I want to see normal prices with a short explanation, so that I'm not confused about why the discount disappeared
87. As a Customer, I want the price on my order to stay as it was at checkout even if the Promotion changes later, so that my order is stable
88. As a Customer, I want gifts to be reserved from Available like normal items, so that the shop doesn't promise gifts it doesn't have

### Members

89. As an Admin, I want to add a Member by email, name and role from the member page, so that I can onboard people without them signing up themselves
90. As an invited Member, I want an email that lets me set my own password, so that the Admin never knows my password
91. As an Admin, I want to remove a Member with no orders completely, so that test or mistaken accounts disappear
92. As an Admin, I want removing a Member who has orders to Deactivate them instead, so that order history is kept
93. As a Deactivated Member, I want to be unable to sign in, so that the removal is real
94. As an Admin, I want to be prevented from removing myself or the last Admin, so that the shop is never locked out
95. As an Admin, I want a confirmation step before removing a Member, so that I don't remove someone by accident

### หน้าร้าน

96. As a shopper, I want a Hero with 4 slides (ด้วง / อาหาร / ขอนไม้ / อุปกรณ์) that change automatically every 6 seconds, so that the shop feels alive
97. As a shopper, I want beautiful beetle photos with subtle animation on the Hero, so that the shop looks premium
98. As a shopper, I want each Hero slide to have a button to its Category, so that I can jump straight to what I want
99. As a shopper, I want the slides to pause when I hover and to have dots/arrows I can use, so that I can read at my own pace
100. As a shopper who prefers reduced motion, I want no automatic animation, so that the page is comfortable for me
101. As a shopper, I want search, category chips and sort in one slim toolbar right after the Hero that stays at the top when I scroll, so that it saves space and matches the Hero
102. As a shopper, I want product cards to stay as they are, so that the catalogue remains familiar
103. As a signed-in Customer, I want my Favorites to appear first within whatever filter and search I'm using, still in the chosen sort order, so that I find them quickly
104. As a reader of the About page, I want sections laid out left-right alternately with even spacing, beetle photos and icons, so that the story is easy and pleasant to read
105. As a shopper, I want photo credits where the licence requires them, so that the shop uses images legally

### ภาษา

106. As a Thai reader, I want every label, button, status, message, date and notification in Thai (except the logo), so that the whole site reads naturally
107. As an English reader, I want every label, button, status, message, date and notification in English, so that the whole site is usable for me
108. As a reader, I want content entered by people to show in its own language: product and Promotion names in my language (falling back to Thai when English is empty), and Cancel Reasons and notes as written, so that nothing is mistranslated

### ลืมรหัสผ่าน

109. As a Customer who forgot my password, I want to request a reset email from the login page and set a new password from its link, so that I can get back into my account
110. As the shop owner, I want step-by-step instructions to set up custom SMTP and the reset redirect URL in Supabase, so that reset emails arrive reliably

## Implementation Decisions

### Order Status

- Order Status values: `awaiting_payment`, `paid`, `waiting_shipping`, `shipping`, `confirmed`, `cancelled` The payment status column and its constraint are removed from the model. Orders gain `refunded_at`, `shipped_at`, `confirmed_at`, `confirmed_by` (`customer` | `admin` | `auto`), and the existing `cancel_reason`, `admin_note` and `tracking_number` are kept
- Legal transitions (the order-status module is the single source, mirrored in DB functions):
  - `awaiting_payment` → `paid` (Stripe webhook only) → `waiting_shipping` (automatic, same transaction for now)
  - `waiting_shipping` → `shipping` (Admin, Tracking Number required)
  - `shipping` → `confirmed` (Customer, Admin, or auto after 7 days)
  - `awaiting_payment` → `cancelled` (Customer, Admin, expiry)
  - `paid` / `waiting_shipping` → `cancelled` (Admin only, with full Stripe refund)
- The idempotent mark-paid DB function moves the order straight to `waiting_shipping` and records the paid time. LINE alert to the Owner keeps firing at this moment (ADR 0002). Later, the LINE OA integration will move `paid` → `waiting_shipping` only after the alert succeeds
- Admin cancel of a paid order: the backend creates the Stripe refund first. Only when it succeeds does it call the cancel DB function with the refunded flag, so the refund and the status change happen together. If the refund fails, the order is left as is and the error is shown
- Expiry: the existing background job that cancels unpaid orders past their reservation sets the system Cancel Reason "Payment time expired" and sends the Cancelled notification. The UI shows the reason in the reader's language because it is a known system code
- The same background job also: auto-confirms `shipping` orders older than 7 days, sends the "please confirm receipt" notification for `shipping` orders older than 3 days that haven't had one, and sends Promotion-start notifications for Promotions whose start time has passed and haven't been announced. Each step is idempotent

### สต็อก

- Products: rename `stock` to `available` and add `on_hand`, both non-negative, with the invariant `available ≤ on_hand`. In Transit is computed from Shipping orders, not stored
- Atomic DB functions (service role only):
  - create order: takes Available for paid lines and gift lines
  - cancel order: returns Available exactly once (keeps the existing released flag)
  - confirm order: reduces On Hand exactly once
  - receive stock: adds a positive delta to both numbers
  - adjust stock: a correction that may reduce On Hand/Available but never below zero or break the invariant
- The public product API exposes Available only; admin APIs expose On Hand, Available and In Transit

### Notification

- New `notifications` table: recipient member, type (`awaiting_payment` | `shipping` | `confirm_request` | `cancelled` | `promotion`), related order or Promotion, a small data payload (order number, tracking number, cancel reason, promotion names), read time, created time. RLS lets a member read and mark only their own rows
- Text is rendered on the frontend from type + payload through i18n, so it follows the current language
- API: list my notifications (newest first, paged) with unread count, mark one read, mark all read. The frontend polls every 60 seconds while signed in and the tab is visible
- Promotion notifications go to every non-deactivated Customer when the Promotion starts, not when it is created

### Shipping Rule และ Promotion

- New tables: shipping tiers (min units, max units or open-ended, fee) and a single Free Shipping Threshold setting (using the existing app settings store); promotions (Thai/English name, start/end, covers all or chosen products, discount tiers, gift rule and gift products, per-Customer cap, distinct-Customer cap, active flag); promotion products; promotion gift products; redemptions (promotion, member, order, released time)
- Saving tiers validates contiguity from 1, no overlap, exactly one open-ended last tier, and non-negative fees. The env flat fee is used only as a fallback until tiers exist
- **Pricing module (new, pure, no DB):** input = cart lines, the active Promotions with their rules, the Shipping Rule, the Customer's existing Redemption counts per Promotion, distinct-Customer counts, and gift choices. Output = per-line unit price and discount with the Promotion applied, gift lines (with "out of stock" markers), next-tier hints, item subtotal, discount total, Shipping Fee, grand total, and the Promotions to redeem. Rules:
  - Choose for each line the single Promotion that gives the largest saving for the whole cart
  - Covered units count together per Promotion; only the highest Discount Tier reached applies
  - Gifts are floor(paid covered units / X) × Y
  - Shipping counts only paid units; free when the item total after discounts reaches the threshold
  - A Promotion that is outside its dates, inactive, or over a cap is ignored
- **Price-preview endpoint:** the Cart and Checkout call it with their lines and gift choices. Order creation calls the same module server-side inside the order-creation flow, then the create-order DB function stores the snapshot (unit price, discount, promotion, gift flag) on Order Items and the Shipping Fee, and records Redemptions atomically, re-checking caps under lock
- The Stripe Checkout Session is built from the stored Order Items: discounted unit prices for paid lines, a line for the Shipping Fee, and no Stripe line for gifts. The Stripe total therefore equals the order total
- Cancel releases Redemptions; Confirmed doesn't change them
- Promotion edits after the start date are limited to name, end date and active flag; deletion only with zero Redemptions. Both rules are enforced in the API
- Dates are stored as timestamps computed from Thai-time dates: start at 00:00 Asia/Bangkok, end at 23:59:59 Asia/Bangkok

### Admin

- Overview stats endpoint returns: count per status (all six), Confirmed count, and Revenue = sum of totals of Confirmed orders
- Orders admin: status filter uses the new values; the table gains Admin Note (inline editable) and a Cancel action with a required-reason dialog; Ship requires Tracking Number; Confirm-for-customer action on Shipping orders. The payment status column is removed
- Products admin: On Hand / Available / In Transit columns; receive-stock and adjust actions; a star toggle for Best Seller in each row; the active switch is fixed to fit its cell
- Members admin: add Member = Supabase admin invite by email (sends a set-password email) plus the chosen role and name. Remove = hard-delete the auth user when the Member has no orders, otherwise Deactivate (ban in Supabase Auth plus a `deactivated_at` on the profile; the auth middleware rejects deactivated Members). Self-removal and removal of the last Admin are refused

### หน้าร้าน

- Hero: 4 slides with auto-advance every 6 s, pause on hover/focus, dot and arrow controls, `prefers-reduced-motion` disables autoplay and motion. Images are openly licensed (Unsplash / Pexels / Wikimedia CC0 or CC-BY), stored in the frontend's public assets, and credited where required. Each download is approved by the owner first. Slide copy is in i18n
- Products page: the heading block is removed; a single sticky toolbar (search, category chips, sort) follows the Hero, using the same tokens as the Hero. Product cards are unchanged
- Favorites ordering: when signed in, the visible (filtered + searched) list is split into favorites and the rest, each kept in the chosen sort, favorites first. Pagination applies after this ordering
- About page: alternating left/right rows with even spacing, each with a beetle image and an icon, using the existing story content

### ภาษา

- Sweep every page and component for hard-coded strings; all UI text, statuses, dates (locale-aware formatting) and notification texts go through i18n with complete `th` and `en` resources. Product and Promotion names use the localized field with Thai fallback. Cancel Reason and Admin Note show as entered
- A test fails if any key exists in one locale but not the other

### ลืมรหัสผ่าน

- The existing reset flow is kept. Verify it end-to-end, fix any defect found, and add a README section for custom SMTP and the `/reset-password` redirect URL in Supabase (done by the owner, since it needs provider keys)

### Migration

- One new idempotent migration `005` adds and changes all of the above and converts data:
  - `pending` → `awaiting_payment`, `paid` → `waiting_shipping`, `shipped` → `shipping`, `delivered` → `confirmed`, `cancelled` → `cancelled`, with `refunded_at` set when the old payment status was `refunded`
  - `available` = old stock, `on_hand` = old stock + units in non-final orders
- The owner runs it in the Supabase SQL Editor. Nobody runs it against the live database from the agent

## Testing Decisions

- Good tests exercise external behaviour through the highest seam available: given a starting state and an action, assert on what a caller can observe (rows, API responses, rendered text). They do not assert on private helpers, query shapes or component internals
- **DB seam** (PGlite migration tests, prior art: the existing migration test). Covers:
  - Migration 005 applies cleanly on top of 001–004 and is idempotent
  - Data conversion of statuses and stock
  - Every legal and illegal status transition through the DB functions
  - Available/On Hand behaviour on create, cancel (once only), confirm (once only), receive and adjust
  - The invariant and non-negative guards
  - Redemption recording, cap enforcement under the create-order function, and release on cancel
  - Notification RLS (a member sees only their own rows)
- **Pricing module seam** (new, unit tests with node:test, prior art: the order-status and validation unit tests). Covers:
  - Tier selection and highest-tier-only
  - Mixed products counting together
  - Best-Promotion choice and no stacking
  - Percent vs baht
  - Gift repetition, gift choice and out-of-stock gifts
  - Caps per Customer and distinct Customers
  - Date window edges in Thai time
  - Shipping tiers, gifts excluded, free threshold after discount
  - Next-tier hints
  - Totals that match the Stripe line construction
- **Order-status module** (existing unit tests): the new transition table and cancel rules
- **HTTP seam** (existing routes test): every new endpoint rejects missing sessions and non-admins where required; validation of Shipping Tiers, Promotion payloads, Cancel Reason and Tracking Number
- **Frontend seam** (existing app-shell harness that renders as guest, Customer or Admin with a mocked API; prior art: the admin dashboard, shop-and-members, checkout and order-detail tests). Covers:
  - Bell visibility, unread count, mark read and navigation
  - Order statuses and timeline in both languages
  - Customer confirm-receipt
  - Admin cancel dialog requiring a reason; Ship requiring a Tracking Number; Admin Note
  - Overview cards
  - Stock columns, star toggle and switch rendering
  - Rules page validation messages
  - Promotion badge, cart discount/gift lines, next-tier hint and gift choice
  - Checkout totals
  - Members add/remove/deactivate flows and guards
  - Hero autoplay controls and reduced motion
  - Sticky toolbar
  - Favorites-first ordering
  - About layout content
  - The locale-parity test
- Real-system check after the owner runs migration 005: drive the app in the browser against the real Supabase and Stripe test mode through order → pay → ship → confirm, admin cancel with refund, and a Promotion purchase

## Out of Scope

- Sending order data to LINE OA and the separate `paid` → `waiting_shipping` step it will drive (Paid moves on immediately for now)
- Email or LINE notifications to Customers (the bell only)
- A notification bell feed for Admins about new orders
- Coupon codes, stacking Promotions, and per-Category or per-weight Shipping Fees (e.g. different fees for live beetles)
- Partial refunds and after-sale refunds once Shipping (still manual, per the Refund rules in CONTEXT.md)
- Running migrations against the live database, and committing or pushing
- Configuring SMTP provider keys (owner's task; the agent writes the instructions)

## Further Notes

- Suggested build order (each phase leaves tests green):
  1. Order Status + On Hand/Available + cancel with reason/refund + Notification
  2. Admin orders/stock/Overview/Members
  3. Rules: Shipping Rule + Promotion + pricing everywhere
  4. Storefront: Hero, toolbar, Favorites-first, About
  5. Language sweep + forgot-password check
- Risk: removing the payment status column touches the Stripe webhook and reconciliation paths; keep `mark_order_paid` idempotent and the "payment arrived after cancel" admin-note behaviour
- Risk: a Customer may hold the price preview and then a Promotion ends before paying. Order creation reprices server-side, so the order total is what the Customer sees on the Stripe page
- Suggestions the owner may want later: a "สินค้าโปรโมชัน" filter chip; a Hero slide that features the current Promotion automatically; a low-Available alert on the Admin stock screen; Promotion performance on the Overview
