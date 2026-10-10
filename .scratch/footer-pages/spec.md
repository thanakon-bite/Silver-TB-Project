# Spec: ทำเมนู footer/navbar ให้ใช้งานได้ครบ (ติดต่อเรา, นโยบายจัดส่ง, FAQ, ข้อกำหนด, ความเป็นส่วนตัว)

**Label:** ready-for-agent
**Branch:** fix/checkout-polish
**อ้างอิง:** `CONTEXT.md` (Shipping Day, Live Arrival Guarantee, Refund, Shipping Fee, Reservation, Order Status), `design.md`, ADR 0001 (Stripe-hosted Checkout)

## Problem Statement

ลูกค้าที่เลื่อนลงมาดู footer หรือกด "ติดต่อเรา" บน navbar จะเจอเมนูที่กดแล้วได้หน้าว่าง "กำลังจัดทำ" ถึง 5 เมนู ได้แก่ ติดต่อเรา, นโยบายจัดส่ง, ข้อกำหนดการให้บริการ, นโยบายความเป็นส่วนตัว และคำถามที่พบบ่อย ร้านขายสัตว์มีชีวิตจึงไม่มีคำตอบให้คำถามที่ลูกค้าถามก่อนจ่ายเงินมากที่สุด เช่น ส่งวันไหน ค่าส่งเท่าไร ถ้าด้วงตายระหว่างทางทำยังไง และคืนเงินได้ไหม

นอกจากนี้:
- หน้าแรกสัญญาว่า "รับประกันการรอดชีวิต 30 วันเมื่อถึงมือคุณ" ซึ่งไม่ใช่เงื่อนไขจริงของร้าน เงื่อนไขจริงคือ **Live Arrival Guarantee**
- ลิงก์ "เรื่องราวของเรา" พาไปหน้าที่ไม่มีเรื่องราว มีแค่ที่ตั้งและช่องทางติดต่อ
- ลิงก์ "สมัครสมาชิก" เปิดแท็บเข้าสู่ระบบ ไม่ใช่แท็บสมัครสมาชิก
- ชื่อและที่อยู่ร้านใน footer ("ซิลเวอร์ทีฟบัคฟาร์ม, ลำนารายณ์, ชัยบาดาล") ไม่ตรงกับหน้า About

## Solution

- **ติดต่อเรา** แสดงข้อมูลติดต่อชุดเดียวกับหน้า About ได้แก่ โทร อีเมล โซเชียล ที่อยู่ และแผนที่ ไม่มีฟอร์ม
- **นโยบายจัดส่ง** เป็นที่เดียวที่อธิบาย Shipping Fee, Shipping Day, Live Arrival Guarantee และ Refund ส่วนจุดอื่น (หน้าแรก, หน้ารายละเอียดด้วง) แค่สรุปหนึ่งบรรทัดแล้วลิงก์มาที่นี่ ค่า Shipping Fee อ่านจากระบบ จึงตรงกับยอดที่ checkout คิดจริงเสมอ
- **คำถามที่พบบ่อย** เผยแพร่เฉพาะคำถามที่ยืนยันได้จากระบบและนโยบาย คำถามเรื่องการเลี้ยงร่างไว้แต่ยังไม่แสดง จนกว่าเจ้าของร้านจะตรวจ
- **ข้อกำหนด และนโยบายความเป็นส่วนตัว** ร่างไว้ในโปรเจกต์ โดยใส่ช่องว่าง `[ชื่อผู้ขาย]` ลิงก์ใน footer ถูกซ่อน และ route ยังเปิดไม่ได้ จนกว่าจะเติมชื่อผู้ขาย
- **เกี่ยวกับเรา** เปลี่ยนชื่อลิงก์ "เรื่องราวของเรา" เป็น "เกี่ยวกับเรา" ให้ตรงกับเนื้อหาที่มี
- **สมัครสมาชิก** พาไปแท็บสมัครสมาชิกทันที
- **ชื่อและที่อยู่ร้าน** ใช้ "Silver Thief Bug" และ "1 ต.ลำนารายณ์ อ.ชัยบาดาล จ.ลพบุรี 15130" ชุดเดียวทุกจุด
- **ภาษา** ทุกหน้ามีทั้งไทยและอังกฤษ โดยภาษาไทยเป็นหลัก

## User Stories

1. As a shopper, I want every link in the footer to open a page with real content, so that the shop looks finished and trustworthy.
2. As a shopper, I want "ติดต่อเรา" in the navbar to show the shop's phone, email and social channels, so that I can ask a question before buying.
3. As a shopper on a phone, I want to tap the phone number to call, so that I don't have to copy it.
4. As a shopper, I want to tap the email address to open my mail app, so that I can write to the shop at once.
5. As a shopper, I want the contact page to show where the farm is on a map, so that I know the beetles come from a real place.
6. As a shopper, I want the same shop name and address everywhere, so that I'm not unsure which shop I'm dealing with.
7. As a shopper, I want the shipping policy to state the Shipping Fee, so that I know the full cost before checkout.
8. As a shopper, I want the Shipping Fee in the policy to always match what checkout charges, so that I'm never surprised at payment.
9. As a shopper, I want to see "ฟรี" when shipping costs nothing, so that the policy reads the way checkout does.
10. As a shopper, I want to know that live beetles ship only Monday to Wednesday, so that I can expect when my beetle will leave.
11. As a shopper, I want to know why beetles don't ship Thursday to Sunday, so that the rule feels like care, not inconvenience.
12. As a shopper buying food, logs or gear only, I want to know these ship on any working day, so that I'm not made to wait for a Shipping Day.
13. As a shopper, I want to know the shop ships within 1–3 working days of payment, so that I can plan to be home.
14. As a shopper, I want to know which carriers carry live beetles (Kerry, Flash), so that I can watch for the right parcel.
15. As a shopper, I want to know the shop may postpone a Shipping Day for extreme heat or heavy rain and will tell me first, so that a delay doesn't alarm me.
16. As a shopper, I want to know the shop ships everywhere in Thailand, so that I know my area is covered.
17. As a shopper, I want the Live Arrival Guarantee explained in one place, so that I know exactly what is and isn't covered.
18. As a shopper, I want to know I must film an uninterrupted unboxing video, so that I can prepare before the parcel arrives.
19. As a shopper, I want to know I must report a dead-on-arrival beetle within 2 hours, so that I don't lose the guarantee by waiting.
20. As a shopper, I want to know the shop sends a replacement of the same species at its own cost, or refunds the beetle's price if none is in Stock, so that I know what I'll get back.
21. As a shopper, I want to know the guarantee doesn't cover a parcel delayed or returned because I was unavailable, so that I make sure someone can receive it.
22. As a shopper, I want to know the guarantee doesn't cover a wrong address or phone number, so that I check them at checkout.
23. As a shopper, I want to know the guarantee doesn't cover death after unboxing, so that I understand it isn't a survival promise.
24. As a shopper, I want to know how a Refund is paid (back through my original card or PromptPay payment), so that I know where to look for the money.
25. As a customer with a Paid order that hasn't shipped, I want to know I can get a full Refund by contacting the shop, so that I don't feel trapped after paying.
26. As a customer, I want to know a live beetle can't be refunded for a change of mind, so that I decide before paying.
27. As a customer, I want to know unopened gear can be returned within 7 days at my own postage, refunded once the shop receives it, so that I can buy gear with less risk.
28. As a customer, I want to know food and logs/substrate can't be returned unless they arrived damaged or wrong, so that the rule's reason (spoilage, hygiene) is clear.
29. As a customer whose goods arrived damaged or wrong, I want to know the shop covers the cost, so that I'm not charged for the shop's mistake.
30. As a shopper on the home page, I want the guarantee to describe the real promise, so that I'm not misled by "30 days".
31. As a shopper viewing a live beetle's details, I want a one-line Live Arrival Guarantee with a link to the full terms, so that I see the promise where I decide.
32. As a shopper viewing food, logs or gear, I don't want the live-beetle guarantee line, so that it doesn't confuse what applies.
33. As a shopper, I want an FAQ that answers how to pay (card or PromptPay through Stripe's secure page), so that I'm confident paying.
34. As a shopper, I want the FAQ to explain that items are held for me for 30 minutes after I continue to payment (a Reservation), so that I don't lose a one-of-a-kind beetle by dawdling.
35. As a shopper, I want the FAQ to explain that my Cart doesn't hold Stock, so that I'm not surprised when a beetle sells while it sits in my Cart.
36. As a customer, I want the FAQ to explain how to cancel a Pending order myself, so that I can change my mind before paying.
37. As a customer, I want the FAQ to explain that a Paid order is cancelled by contacting the shop, so that I know the path.
38. As a customer, I want the FAQ to tell me where to find my Tracking Number (My orders), so that I can follow my parcel.
39. As a shopper, I want the FAQ to explain why favorites need an account, so that signing in has a clear reason.
40. As a shopper, I want the FAQ to point to the shipping policy for the guarantee and refunds, so that answers don't contradict each other.
41. As a shopper, I want FAQ answers to open and close one at a time on my phone, so that the page stays short.
42. As a keyboard or screen-reader user, I want FAQ questions to work as native disclosure controls, so that I can open them without a mouse.
43. As the shop owner, I want care questions kept out of the FAQ until I've checked them, so that the shop never publishes wrong care advice.
44. As the shop owner, I want the Terms and Privacy drafts to wait until I supply the seller's name, so that the shop never publishes a legal page with a blank in it.
45. As a shopper, I don't want to see Terms or Privacy links that lead nowhere, so that the shop doesn't look unfinished.
46. As the shop owner, I want to publish Terms and Privacy by filling in the seller's name in one place, so that going live is a one-step change.
47. As a customer, I want the Privacy policy (once published) to say what data the shop keeps (name, email, phone, addresses, orders, favorites) and who processes it (the database host, Stripe, the Owner's LINE message), so that I know where my data goes.
48. As a customer, I want the Privacy policy to say the shop never sees my card details, so that I trust paying.
49. As a customer, I want the Privacy policy to say order history is kept 5 years for accounting and everything else is deleted on request, so that I know my rights under PDPA.
50. As a customer, I want the Privacy policy to name the email address for data requests, so that I can ask to see or delete my data.
51. As a shopper who taps "สมัครสมาชิก", I want the sign-up form to open directly, so that I don't have to find the other tab.
52. As a shopper, I want the "about" link to be called "เกี่ยวกับเรา", so that it promises only what the page has.
53. As an English-reading shopper, I want every new page in English too, so that I can read the policies.
54. As a shopper, I want the policy pages to look like the rest of the shop (same header, type and spacing), so that they feel part of it.
55. As a shopper, I want the shipping policy to tell me who to contact if something goes wrong, so that I have a next step.
56. As a shopper on the checkout's focused footer, I want the "นโยบายจัดส่ง" link to reach the real policy, so that I can check it while paying.

## Implementation Decisions

- **Policy content lives in the repo, in both locale files.** No admin editing and no database table. Policies change rarely; this can move later if they start changing often.
- **One reusable "policy page" layout.** It has the shared page header, prose sections and a "last updated" date. Shipping, FAQ, Terms and Privacy all use it. Contact uses the About page's contact section.
- **The contact section is extracted from the About page** into one component, used by About and by `/contact`. The shop's phone, email, map link and social channels keep coming from the existing shared brand module. `/contact` stays a real route; the navbar link is unchanged.
- **The shipping policy reads the Shipping Fee from the existing public endpoint** that checkout already uses (`GET /orders/shipping-fee`). Zero shows as "ฟรี" and any other value as a baht amount. The fee is never written into copy. If the request fails, the fee sentence says it is shown at checkout; the rest of the page still renders.
- **The reservation window in FAQ copy is 30 minutes, stated as text.** The server exposes no endpoint for it; adding one is out of scope. If the server value changes, the FAQ copy must change with it. Note this beside the copy.
- **Unpublished pages are gated by one publish flag per page** (Terms, Privacy, and the FAQ care section), all off. A gated route falls through to the app's existing catch-all redirect, and its footer link is not rendered. Publishing means filling `[ชื่อผู้ขาย]` in both locales and turning the flag on.
- **FAQ uses native disclosure elements** (`details`/`summary`), styled with the design system, grouped under headings: ordering and payment, shipping and guarantee, account.
- **Login reads an optional mode from the URL** (`?mode=signup`) as its initial tab. The `redirect` parameter keeps working alongside it. The footer's "สมัครสมาชิก" link uses it.
- **Copy changes:**
  - The home page promise becomes "รับประกันถึงมือมีชีวิต" with the short terms (unboxing video, report within 2 hours).
  - The beetle product detail gains one line with a link to the shipping policy. It shows only when the Category is `beetle`.
  - The footer's link "เรื่องราวของเรา" becomes "เกี่ยวกับเรา".
  - The footer's address string becomes "1 ต.ลำนารายณ์ อ.ชัยบาดาล จ.ลพบุรี 15130" in Thai, matching the About page.
- **Vocabulary follows `CONTEXT.md`:** Live Arrival Guarantee (never "health guarantee" or "30-day"), Shipping Day, Refund, Reservation, Shipping Fee, Order Status names in Thai.
- **Terms content (draft):** seller identity placeholder; how ordering works (Order Status flow; only Stripe makes an order Paid, per ADR 0001); prices and Stock re-checked at checkout; Reservation and expiry; cancellation and Refund (link to shipping policy); live animals and the customer's responsibility after unboxing; governing law: Thailand.
- **Privacy content (draft):** controller placeholder; data collected; purposes; processors (database host, Stripe, LINE message to the Owner); the shop never sees card data; retention (orders 5 years, the rest deleted on request); rights under PDPA and the request email.

## Testing Decisions

- **One seam: the app shell rendered through the existing page harness**, with the real Auth and Cart providers, the real Thai strings and a router. Only the API client and Supabase are mocked. This is the same rule as the existing Checkout and OrderDetail tests. The harness gains the ability to mount the app shell (navbar, routes, footer) at a given URL. No other new seams.
- **Tests assert what a customer sees and can do.** They check visible text, links and roles; they don't check component structure, class names or translation keys.
- **Behaviours to cover:**
  - The footer shows Shipping, FAQ and Contact links, and does not show Terms or Privacy.
  - Visiting `/terms` or `/privacy` lands on the home page (the catch-all).
  - `/contact` shows the phone as a `tel:` link, the email as a `mailto:` link, and the three social links.
  - `/shipping` shows "ฟรี" when the mocked fee is 0 and a baht amount when it is non-zero. It shows the Monday–Wednesday rule, the 2-hour reporting window, and the "not covered" cases. When the fee request fails, it still renders with the "shown at checkout" fallback.
  - `/faq` shows the system questions; a question opens on activation; no care question is present.
  - The footer's "สมัครสมาชิก" opens Login with the sign-up form showing (the full-name field is present).
  - The home page no longer contains "30 วัน", and does contain the Live Arrival Guarantee wording.
  - Product detail for a `beetle` shows the guarantee line linking to `/shipping`; for `food` it does not.
- **Prior art:** the existing Checkout and OrderDetail page tests and their mocking of the API client and Supabase.

## Out of Scope

- A contact form, or any new backend endpoint (including one for the reservation window).
- Admin editing of policy content.
- The "Our Story" section of About, which waits on facts from the owner.
- Publishing Terms, Privacy or FAQ care answers, which wait on the seller's name and the owner's review.
- Legal review of Terms and Privacy. Recommended before publishing; not done by the agent.
- Changing the Shipping Fee or reservation values themselves.
- A terms-acceptance checkbox at checkout.

## Further Notes

- Still needed from the owner, none of which blocks this work:
  - the seller's legal name, entity type and e-commerce registration number;
  - facts for "Our Story";
  - a review of the drafted care answers.
- The checkout's focused footer already links to `/shipping`; it starts showing real content with no change.
- If the production Shipping Fee is not 0, the policy picks it up automatically through the endpoint.
