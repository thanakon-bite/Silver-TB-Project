# Spec: หน้าคำสั่งซื้อ (/orders/:id) ใช้ระบบดีไซน์เดียวกับ checkout

**Label:** ready-for-agent
**Branch:** fix/checkout-polish
**อ้างอิง:** `design.md`, `CONTEXT.md`, ADR 0001 (Stripe-hosted Checkout), `.scratch/checkout-redesign/issues/`

## Problem Statement

Customer ที่จ่ายเงินบนหน้า Stripe เสร็จจะถูกส่งกลับมาที่หน้าคำสั่งซื้อ หน้านี้เป็นหน้าแรกที่บอกว่าเงินถึงร้านหรือยัง แต่ตอนนี้:

- ทั้งหน้าเป็นภาษาอังกฤษ ทั้งสถานะ ("Awaiting payment"), timeline, ข้อความแจ้ง, ปุ่ม และวันที่ ทั้งที่ทุกขั้นก่อนหน้าเป็นภาษาไทย
- ดีไซน์เป็นแบบเก่า มีการ์ดสีขาวซ้อนกันห้ากล่อง, pill สถานะสีเหลือง/ฟ้า/ม่วง, ปุ่มส้ม gradient จึงดูเหมือนคนละร้านกับหน้า checkout ที่เพิ่งผ่านมา
- การยกเลิกใช้ popup SweetAlert ภาษาอังกฤษ และ error ก็แสดงเป็น popup
- ต้องกด "Complete payment" ก่อนจึงจะเห็นปุ่มชำระจริง
- Order ที่ Reservation หมดแล้ว หรือที่การชำระครั้งก่อนล้มเหลว ไม่มีข้อความบอกว่าเกิดอะไรขึ้น
- ถ้า webhook ของ Stripe มาช้ากว่า 90 วินาที Cart จะไม่ถูกล้าง แม้จะจ่ายสำเร็จแล้ว
- การยกเลิกที่ถูกปฏิเสธส่งข้อความอังกฤษจาก server ออกมาตรงๆ เพราะไม่มี error code ให้แปล

## Solution

หน้าคำสั่งซื้อใช้ระบบเดียวกับ checkout ตาม `design.md` คือพื้นกระดาษ, ตัวอักษรหมึก, สีส้มเดียว และภาษาไทยทั้งหน้า

- หัวหน้าบอกสถานะเป็นคำไทยตัวใหญ่ ใต้หัวมี Order Number
- ข้างใต้เป็น timeline แนวตั้งที่บอกว่าคำสั่งซื้อไปถึงไหนแล้ว และแสดง Tracking Number พร้อมปุ่มคัดลอก
- จอกว้างแสดงสรุปคำสั่งซื้อ (รูป ชื่อ จำนวน ราคา ค่าจัดส่ง ยอดสุทธิ) ด้านขวา บนมือถือพับเหลือแถบยอดรวม
- Order ที่ยังจ่ายได้แสดงตัวนับเวลาจองและปุ่ม "ชำระ ฿…" ทันที ใต้ปุ่มมีลิงก์ยกเลิกที่ยืนยันในหน้า ไม่มี popup
- ทุก error และทุก notice อยู่ในหน้าเป็นภาษาไทย พร้อมบอกว่าลูกค้าต้องทำอะไรต่อ

## User Stories

1. As a Customer returning from Stripe, I want the page to tell me in Thai that it is confirming my payment, so that I know to wait instead of paying again.
2. As a Customer returning from Stripe, I want the heading to change to "ชำระแล้ว" as soon as the shop confirms my payment, so that I know my beetle is mine.
3. As a Customer whose payment confirmation is slow, I want to be told it has not arrived yet and that I should not pay again, so that I am not charged twice.
4. As a Customer who just paid, I want my Cart emptied, so that I don't accidentally order the same beetle again.
5. As a Customer who just paid, I want the Cart emptied even if the confirmation arrives after the page stops checking, so that the result doesn't depend on how fast Stripe is.
6. As a Customer opening an old order from my order list, I want my current Cart left alone, so that viewing history never throws away what I am shopping for now.
7. As a Customer, I want the heading to be the Order Status in Thai (รอชำระเงิน · ชำระแล้ว · จัดส่งแล้ว · ได้รับสินค้าแล้ว · ยกเลิกแล้ว), so that I understand where my order is at a glance.
8. As a Customer whose cancelled order was refunded, I want to see "ยกเลิกและคืนเงินแล้ว", so that I know the money is coming back.
9. As a Customer, I want to see my Order Number under the heading in a fixed-width face, so that I can read it out to the shop over LINE.
10. As a Customer, I want a vertical timeline (สั่งซื้อ → ชำระแล้ว → จัดส่งแล้ว) with Thai dates in the Buddhist year, so that I can see when each step happened.
11. As a Customer, I want the "ได้รับสินค้าแล้ว" step shown only once it has happened, so that I am not left with a step that looks stuck forever.
12. As a Customer whose order has shipped, I want to see the carrier and Tracking Number, so that I can follow my parcel.
13. As a Customer, I want a "คัดลอก" button beside the Tracking Number that says "คัดลอกแล้ว" briefly, so that I can paste it into the carrier's app without selecting text on a phone.
14. As a Customer, I want a cancelled order to show no timeline, so that I am not shown steps that will never happen.
15. As a Customer, I want to see every Order Item with its picture, quantity and price, so that I know exactly what I bought.
16. As a Customer, I want the Shipping Fee shown, with "ฟรี" when it is zero, so that the total makes sense.
17. As a Customer on a phone, I want the summary folded into a bar showing the total that opens on tap, so that the status and actions come first.
18. As a Customer on a wide screen, I want the summary beside the details and sticky, so that the amount is always in view.
19. As a Customer, I want to see the Shipping Address Snapshot the order will go to, so that I can spot a wrong address before it ships.
20. As a Customer with a Pending order I can still pay, I want the Reservation countdown and the "ชำระ ฿…" button shown right away, so that paying takes one tap.
21. As a Customer who pressed back on Stripe's page, I want to land on a page where I can try paying again, so that I don't have to start checkout over.
22. As a Customer whose previous payment attempt failed, I want to be told in Thai that it failed and that I can try again, so that I know the order is still open.
23. As a Customer, I want "ยกเลิกคำสั่งซื้อ" as a quiet link under the pay button, so that the main action stays paying.
24. As a Customer, I want to confirm a cancellation on the page itself ("ยกเลิกคำสั่งซื้อนี้? สินค้าที่จองไว้จะถูกปล่อยให้คนอื่นซื้อได้" with [ยืนยันยกเลิก] and [เก็บไว้]), so that I can't release a one-of-a-kind beetle by accident.
25. As a Customer who pressed "เก็บไว้", I want nothing to happen to my order, so that changing my mind is safe.
26. As a keyboard or screen-reader Customer, I want focus moved to "เก็บไว้" when the confirmation appears, so that the safe choice is the default.
27. As a Customer who confirmed the cancellation, I want the heading to become "ยกเลิกแล้ว" without a popup, so that the page itself is the receipt.
28. As a Customer whose cancellation was refused, I want a Thai explanation in a box above the action with what to do next, so that I am not shown a server message in English.
29. As a Customer who tries to cancel an order that was in fact already paid, I want the page to reload and show "ชำระแล้ว", so that I see the truth.
30. As a Customer whose Reservation ran out, I want a notice that payment time is over and the order will be cancelled automatically, with a link to the products, so that I know what to do next.
31. As a Customer watching the countdown reach zero, I want the pay button and cancel link replaced by that notice, so that I can't start a payment that will be refused.
32. As a Customer, I want a Thai loading message while the order loads, so that the page never shows English.
33. As a Customer opening an order that doesn't exist or isn't mine, or when the network fails, I want a Thai error with a link back to "คำสั่งซื้อของฉัน", so that I am never stuck.
34. As a Customer using dark mode, I want the page in the dark token values, so that it matches the rest of the redesigned shop.
35. As a Customer who prefers reduced motion, I want the confirming spinner not to spin, so that the page respects my setting.
36. As a Customer on a 320 px phone, I want no sideways scrolling and no button label broken onto two lines, so that the page is usable on the smallest screens.
37. As the shop's developer, I want the page to use the shared tokens and existing checkout components, so that one change to the system updates every redesigned page.
38. As the shop's developer, I want the refused-cancellation error to carry a code, so that the frontend can word it in Thai like every other known error.

## Implementation Decisions

- **Shell:** the page keeps the shop's normal nav and footer; it is a destination, not a focused flow like checkout. Its content sits on the paper background. The nav itself is not restyled here.
- **Layout:** the same two-column grid as checkout (`minmax(0,1fr) 22rem` at `lg`).
  - Left column: status heading, notices, timeline, address and actions.
  - Right column: the existing `OrderSummary`, unchanged. The total label is "ยอดสุทธิ". Lines come from Order Items, with each item's saved picture.
  - One containment layer only: sections are split by `line` hairlines, with no cards.
- **Heading:** `h1` is the Order Status in Thai in the display serif. Under it, "คำสั่งซื้อ <Order Number>" in mono, `muted`. No coloured status pills. The heading sets `text-ink` itself so the global heading colour rule in the base stylesheet doesn't win.
- **Status vocabulary:** new i18n keys `order_status.{pending,paid,shipped,delivered,cancelled}` plus a refunded-cancelled variant, in both `th` and `en`. The Thai words match `CONTEXT.md`. This page stops using the English `ORDER_STATUS_LABEL`; the order list and admin keep it for now.
- **Dates:** a new date formatter for customers, Thai locale with the Buddhist year (e.g. "10 ต.ค. 2569 14:30"). The existing `dateTime` (used by admin) is not changed.
- **Timeline:** an ordered vertical list. Steps are placed, paid and shipped, plus delivered only when it has a date.
  - Reached steps are `ink` with an `accent-strong` icon; later steps are `muted`.
  - The shipped step carries the carrier and the Tracking Number in mono, with a copy button whose label changes to "คัดลอกแล้ว" for about 2 s. No toast.
  - Cancelled orders have no timeline.
- **Paying:** while the order is payable, `PaymentStep` renders directly, with no "complete payment" gate.
  - Payable means Pending, payment unpaid or failed, and the Reservation not yet expired.
  - When the countdown ends, the page reloads the order. If it is still Pending, the Reservation-expired notice replaces both paying and cancelling.
- **Cancelling:** a text link under the pay button, `muted`, turning `danger` on hover.
  - Pressing it swaps the link for an inline confirmation: a sentence plus [ยืนยันยกเลิก] and [เก็บไว้]. Focus moves to [เก็บไว้].
  - Confirming posts to the existing cancel endpoint and shows the returned order.
  - On `ALREADY_PAID`, the page reloads the order. Any other failure shows a `danger` box (`role=alert`) above the action, worded through the existing `errorMessage` helper.
  - SweetAlert is not used anywhere on this page.
- **Notices:** all of these are `role=status` on `sunken`, with Thai copy:
  - Confirming payment, with a spinner that has a `motion-reduce:` variant.
  - Not confirmed yet; don't pay again.
  - Paid, thank you. This is a sentence on the page, not a toast.
  - Reservation expired; the order will be cancelled automatically. Links to the products.
  - The previous payment failed; you can try again. Shown above `PaymentStep`.
- **Load failure:** a full-width `danger` box with Thai wording and a link to "คำสั่งซื้อของฉัน". The loading state is Thai.
- **Clearing the Cart:** whenever the page sees this Order as Paid while the URL carries `?paid=1`, it does three things: clears the Cart, removes the saved checkout request key, and drops `?paid=1` from the URL. This includes the first load, not only polling. Without `?paid=1`, the Cart is never touched. Polling keeps today's rhythm: every 2 s for up to about 90 s.
- **Backend: new error code.** A Customer cancelling an order that isn't Pending, or is already paid, is refused with HTTP 409 and code `ORDER_NOT_CANCELLABLE`. The response shape is otherwise unchanged. The decision moves into the existing order-status rules module, next to `checkAdminTransition` and `isPayable`, as a customer-cancel check that returns `{ ok, reason, code }`. The route only translates it into the 409.
- **Thai wording:** a new `api_errors.ORDER_NOT_CANCELLABLE`, saying only unpaid orders can be cancelled and to contact the shop about paid ones. All other new copy goes under a new `order_page` i18n namespace, in both `th` and `en`.
- **Tokens:** no new colour tokens are needed. No inline hex or OKLCH values.

## Testing Decisions

- Tests check what the Customer sees and what goes over the network: headings, roles, text, the Cart's contents, and API calls. They don't check component internals, state or class names.
- **Seam 1: the whole page, via `renderPage`.** It uses the real Auth and Cart providers and real Thai i18n; only the API adapter and Supabase are mocked. New file beside the page. Prior art: the Checkout page test. Cases:
  1. A payable Pending order: heading "รอชำระเงิน", the Order Number, and the "ชำระ ฿…" button present with no prior click.
  2. Cancel: the inline confirmation appears. "เก็บไว้" makes no API call. "ยืนยันยกเลิก" posts to cancel and the heading becomes "ยกเลิกแล้ว".
  3. A cancel refused with `ORDER_NOT_CANCELLABLE`: Thai wording inside `role=alert`.
  4. `?paid=1`: the first load is Pending and the next poll is Paid (fake timers). The heading becomes "ชำระแล้ว" and the Cart is empty.
  5. A shipped order with a Tracking Number: the timeline shows "จัดส่งแล้ว" and the number.
  6. A Pending order whose Reservation has expired: the expired notice and no pay button.
  7. Loading the order fails: Thai error and a link to "คำสั่งซื้อของฉัน".
  8. The page source does not import `sweetalert2`, checked the same way as checkout ticket 06.
- **Seam 2: backend order-status rules, as a pure module.** Prior art: the existing order-status unit tests. Cases: a customer can cancel Pending/unpaid; a Pending/paid order and every non-Pending status are refused with code `ORDER_NOT_CANCELLABLE`.
  - This replaces the HTTP-level backend test agreed during grilling. The existing HTTP route tests run with no database and no session, so they can't reach a cancel on a real paid order without new mocking. The route stays a thin translation of the rule.
- **TDD:** red, then green, at these two seams only.
- **Run:** frontend `CI=true npx react-scripts test --watchAll=false`; backend `npm test`.
- **Manual check:** in Claude in Chrome at 320 / 375 / 414 / 768 px and desktop, light and dark: no horizontal scroll and no two-line button labels.
  - Pending and customer cancel are checked against the real backend with `sk_test`; the user logs in.
  - Paid, shipped and webhook-driven states are proven by the page tests only, because the webhook secret is still a placeholder.
- **Hallmark:** run `hallmark audit` again on this page; it must have no critical findings.

## Out of Scope

- The shop's global nav and footer, the order list page (`/orders`), admin order screens, `ORDER_STATUS_LABEL`/`ORDER_STATUS_STYLE` used by those screens, and the global `h1..h6` colour rule.
- Links to carrier tracking websites (the shop doesn't store a tracking URL per carrier).
- Refunds, and any new Order Status or payment logic. Only Stripe's verified webhook makes an order Paid (ADR 0001).
- The Cart drawer's old styling, and the shared failed-order hint text on checkout.
- Installing the Stripe CLI or a real webhook secret.

## Further Notes

- Stripe returns Customers to `/orders/:id?paid=1` on success and to `/orders/:id` when they go back. Both land here.
- ADR 0001 applies to cancelling: the backend expires the Checkout Session first, and it may refuse while a session it can't see is still within its Reservation. Those refusals arrive as `PAYMENT_PROCESSING`, `ALREADY_PAID` or provider errors, which already have Thai wording.
- In a background Chrome tab, framer-motion animations stall. Force `opacity:1` when inspecting. Check narrow widths with same-origin iframes.
- The tickets will live in `.scratch/order-detail-redesign/issues/`.
