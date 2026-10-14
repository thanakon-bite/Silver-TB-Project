# Spec: หน้าร้านเป็นหน้าแรก, ตะกร้า/รายการโปรดเฉพาะสมาชิก, เมนู Admin และ dashboard ใหม่

**Label:** ready-for-agent
**Branch:** fix/checkout-polish
**อ้างอิง:** `CONTEXT.md` (Product, Category, Stock, Cart, Favorite, Order Status, Customer, Member, Admin), `design.md`, ADR 0001 (Stripe-hosted Checkout)

## Problem Statement

ลูกค้าที่เข้าเว็บจะเจอหน้าแรกที่เป็นเรื่องราวของร้าน ต้องกดอีกครั้งถึงจะเห็นด้วงที่ขาย ส่วนหน้า "เกี่ยวกับเรา" ก็มีแค่ที่ตั้งและช่องทางติดต่อ ซ้ำกับหน้า "ติดต่อเรา" ทุกอย่าง เนื้อหาเรื่องราวของร้านจริง ๆ ไปอยู่ที่หน้าแรกแทน

นอกจากนี้:
- ลิงก์ด่วน "สมัครสมาชิก" ใน footer กดแล้วไม่ได้ไปที่ฟอร์มสมัครสมาชิก
- การ์ดสินค้าในหน้ารายการไม่มีกรอบ ทำให้ดูไม่ออกว่าชื่อ ราคา และปุ่มเป็นของรูปไหน
- คนที่ยังไม่ได้ login เห็นไอคอนตะกร้าและหัวใจ และเพิ่มสินค้าลงตะกร้าได้ ตะกร้าเก็บรวมอยู่บนเครื่องโดยไม่ผูกกับบัญชี คนที่ใช้เครื่องร่วมกันจึงเห็นตะกร้าของกันและกัน
- เปลี่ยนภาษาแล้วบางส่วนของหน้ายังเป็นภาษาเดิมจนกว่าจะรีโหลด
- Admin ต้องหาลิงก์ Admin และไอคอนกล่อง (ออเดอร์ของฉัน) ที่ฝั่งขวาของ navbar ซึ่งไม่มีชื่อกำกับ
- หน้า Admin Overview ยังไม่เหมือน dashboard เพราะไม่มีภาพรวมสถานะออเดอร์ สินค้าแยกหมวด หรือสินค้าใกล้หมดเป็นกราฟ
- รายการ Orders / Products & stock / Customers ยาวเกินไป (20–100 แถวต่อหน้า)
- เปิดกลับสินค้าที่ปิดไว้ต้องเข้าฟอร์มแก้ไข และปิดสินค้าต้องใช้ไอคอนถังขยะ ซึ่งดูเหมือนลบทิ้ง
- Admin สร้างบัญชีให้ลูกค้าไม่ได้ และเปลี่ยน role ได้แค่ผ่านปุ่ม Promote/Demote
- แถบ tabs ในหน้า Admin มี scrollbar แสดงอยู่ทางขวา

## Solution

- `/` คือหน้าร้าน มี Hero ของร้าน (ชื่อ, คำโปรย, ปุ่มดูคอลเลกชัน, ปุ่ม Facebook) อยู่เหนือหัวข้อ "เลือกซื้อด้วงทั้งหมด" ปุ่มดูคอลเลกชันกดแล้วเลื่อนลงไปที่สินค้า `/products` จะ redirect ไป `/`
- `/about` ได้เนื้อหาของหน้าแรกเดิม (คำสัญญา 3 ข้อ, รู้จักด้วง, ชุมชน, CTA กลับหน้าร้าน) และไม่มีส่วนติดต่อซ้ำกับหน้าติดต่อเราแล้ว เมนู "หน้าแรก" ถูกตัดออก
- เมนูหลักเป็น ร้านค้า · เกี่ยวกับเรา · ติดต่อเรา · Admin (เฉพาะ Admin) · รายการออเดอร์ (เฉพาะ Member ที่ login) ไอคอนกล่องและลิงก์ Admin ฝั่งขวาถูกเอาออก
- ลิงก์ "สมัครสมาชิก" แสดงเฉพาะ guest และกดแล้วเปิดฟอร์มสมัครทุกครั้ง
- การ์ดสินค้ามีกรอบรอบทั้งใบ
- ตะกร้าและรายการโปรดมีเฉพาะ Customer ที่ login แล้ว guest ที่กดหัวใจหรือเพิ่มลงตะกร้าจะถูกพาไปหน้า login แล้วกลับมาที่หน้าเดิม
- เปลี่ยนภาษาแล้วหน้าฝั่งลูกค้าเปลี่ยนครบทั้งหน้าทันที
- Admin Overview เป็น dashboard มีแถว KPI, โดนัทสถานะออเดอร์, แท่งจำนวนสินค้าแยกหมวด, แท่งสินค้าใกล้หมด และรายได้รายวัน
- Orders / Products & stock / Members แบ่งหน้าละ 10 รายการ
- Products & stock มี switch เปิด/ปิดใช้งานต่อแถว และตัวกรองตามสถานะ
- tab Customers เปลี่ยนชื่อเป็น Members สร้าง Member ได้ด้วยการส่งอีเมลเชิญ และแก้ role ผ่านไอคอนดินสอ

## User Stories

### หน้าร้านและเนื้อหา

1. As a shopper, I want the first page I land on to show the beetles for sale, so that I can start browsing without an extra click
2. As a shopper, I want to see the shop's name and promise above the product grid, so that I know whose shop I'm in before I browse
3. As a shopper, I want the "ดูคอลเลกชัน" button to scroll me down to the products, so that the button still does something useful on the shop page
4. As a shopper on a laptop, I want the first row of products visible without scrolling past a tall banner, so that the hero doesn't hide the shop
5. As a shopper with an old `/products` bookmark, I want to land on the shop page, so that my link still works
6. As a shopper, I want filters and search on the shop page to keep working as before, so that moving the page didn't break how I find a beetle
7. As a shopper, I want "เกี่ยวกับเรา" to tell me the shop's story, promises and beetle facts, so that the page answers "who are these people"
8. As a shopper, I want "ติดต่อเรา" to be the one place for contact details, so that I'm not shown the same block on two pages
9. As a shopper, I want the CTA at the end of the about page to take me back to the shop, so that I can buy after reading
10. As a shopper, I want the navbar to show ร้านค้า · เกี่ยวกับเรา · ติดต่อเรา without a separate "หน้าแรก", so that the menu has no duplicate entries
11. As a shopper, I want the brand logo to take me to the shop page, so that "home" still works the way I expect
12. As a guest, I want the footer's "สมัครสมาชิก" link to open the sign-up form, so that I can create an account in one click
13. As a guest already on the login page, I want clicking "สมัครสมาชิก" again to switch the form to sign-up, so that the link always does what it says
14. As a signed-in Member, I don't want to see "สมัครสมาชิก" in the footer, so that I'm not offered something I can't use
15. As a shopper, I want each product card to have a visible border around image, name, price and button, so that I can tell which details belong to which beetle
16. As a shopper using a mouse, I want a card's border to darken when I hover it, so that I know which card I'm about to open

### ตะกร้าและรายการโปรด (เฉพาะ Customer ที่ login)

17. As a guest, I don't want to see the cart and heart icons in the navbar, so that I'm not offered features that need an account
18. As a guest, I want tapping the heart on a product to take me straight to the login page, so that I know I need an account to save Favorites
19. As a guest, I want tapping "เพิ่มลงตะกร้า" to take me straight to the login page, so that I know I need an account to buy
20. As a guest who was sent to login from a product, I want to come back to the page I was on after logging in, so that I can carry on where I left off
21. As a signed-in Customer, I want the cart and heart icons with counts in the navbar, so that I can reach my Cart and Favorites
22. As a signed-in Customer, I want my Cart to still be there after I log out and back in on the same device, so that I don't lose what I picked
23. As a Customer sharing a device, I don't want the next person who logs in to see my Cart, so that my shopping stays private
24. As a guest, I don't want to see the Favorites link in the footer or mobile menu, so that guests only see what they can use
25. As a guest who opens `/favorites` directly, I want to be sent to login, so that I don't reach an empty page that can't work
26. As a guest on a phone, I don't want a cart button in the top bar, so that the phone layout matches the desktop rules

### ภาษา

27. As a shopper, I want switching TH/EN to change every piece of text on the page at once, including product names and descriptions, so that I never see a mix of two languages
28. As a shopper, I want the language switch to happen without a page reload, so that I don't lose my place, filters or open drawer
29. As a shopper, I want my language choice remembered on my next visit, so that I don't switch every time

### เมนู Admin และ Member

30. As an Admin, I want an "Admin" menu next to "ติดต่อเรา", so that I can reach the dashboard from the main menu
31. As a signed-in Member, I want a "รายการออเดอร์" menu after it, so that I can find my orders by name instead of guessing an icon
32. As a Customer, I don't want to see the "Admin" menu, so that the menu only shows what I can open
33. As a guest, I want neither "Admin" nor "รายการออเดอร์", so that the menu stays short until I log in
34. As a Member on a phone, I want the same menu entries in the mobile menu, so that both layouts match
35. As an Admin, I don't want a scrollbar showing on the admin tabs bar, so that the tabs look clean
36. As an Admin on a narrow screen, I still want to swipe the admin tabs sideways, so that hiding the scrollbar doesn't hide tabs

### Admin Overview dashboard

37. As an Admin, I want a row of KPI tiles (revenue, orders to fulfil, orders needing attention, Members), so that I see the shop's state at a glance
38. As an Admin, I want a donut of orders by Order Status (Pending, Paid, Shipped, Delivered, Cancelled), so that I see where orders are piling up
39. As an Admin, I want clicking a status in the donut or legend to open Orders filtered to that status, so that I can act on what I see
40. As an Admin, I want a bar chart of how many active Products are in each Category, so that I see the shape of my catalogue
41. As an Admin, I want a horizontal bar chart of active Products with Stock ≤ 2, lowest first, so that I know what to restock
42. As an Admin, I want clicking a low-stock bar to open Products & stock, so that I can adjust Stock right away
43. As an Admin, I want the daily revenue chart kept, so that I don't lose the trend I already use
44. As an Admin, I want every chart to follow light/dark theme and have a table view, so that it stays readable and accessible
45. As an Admin with no orders or no low-stock items, I want each chart to show a clear empty state, so that I don't read a blank box as an error

### Pagination

46. As an Admin, I want Orders, Products & stock and Members to show 10 rows per page, so that each list fits on one screen
47. As an Admin, I want previous/next buttons and "หน้า X / Y · ทั้งหมด N รายการ", so that I know where I am in the list
48. As an Admin, I want a new search or filter to take me back to page 1, so that I don't land on an empty page past the end
49. As an Admin who just changed a row (Stock, status, role), I want to stay on the same page, so that I don't lose my place

### Products & stock

50. As an Admin, I want a switch on each row that turns a Product on (shown in the shop) or off (hidden), so that I can toggle it without opening the edit form
51. As an Admin, I want the switch to replace the trash icon, so that hiding a Product no longer looks like deleting it
52. As an Admin, I want to filter by เปิดใช้งาน / ปิดใช้งาน, so that I can find hidden Products to bring back
53. As an Admin, I want the switch to roll back and show an error if saving fails, so that the list never lies about what shoppers see

### Members

54. As an Admin, I want the tab called "Members", so that the name covers both Customers and Admins in the list
55. As an Admin, I want a "สร้างสมาชิก" button that takes name, email, phone and role (default user), so that I can open an account for someone who orders by phone or LINE
56. As a new Member created by an Admin, I want an invitation email to set my own password, so that nobody else knows my password
57. As an Admin, I want a clear error when the email is already registered, so that I don't create duplicates
58. As an Admin, I want a pencil icon on each row that opens the Member's profile, so that I can see who I'm changing
59. As an Admin, I want the profile modal to show name, email and phone as read-only and let me change only the role, so that I can't accidentally edit a Customer's details
60. As an Admin, I don't want a pencil (or a role change that works) on my own row, so that I can't lock myself out
61. As an Admin, I want the list to update after I save a role, so that I see the change right away

## Implementation Decisions

### Routing and pages
- The shop page moves to `/`. `/products` becomes a redirect to `/`, keeping the query string so filtered links still work. Every internal link to `/products` (footer, cart empty state, order pages, CTAs) points to `/`.
- The Hero becomes its own component above the shop's "เลือกซื้อด้วงทั้งหมด" heading. It is shorter than the old home hero. "ดูคอลเลกชัน" scrolls to the product grid's anchor and respects reduced motion.
- The About page is built from the old home sections (promises, beetle facts, community, closing CTA → `/`). The old Home page component is removed. About no longer renders the contact section.
- The navbar's `NAV` loses `home`. The shop entry matches `/` exactly so it isn't active on every route.

### Navbar
- Order: ร้านค้า, เกี่ยวกับเรา, ติดต่อเรา, then "Admin" (`isAdmin`), then "รายการออเดอร์" (`/orders`, any signed-in Member), on desktop and in the mobile menu.
- The right-hand cluster loses the Package icon and the Admin text link. It keeps cart and heart (signed-in only), theme, language, the account name and logout, or the login button for guests.
- Phones: the top-bar cart button is shown only when signed in.

### Sign-up link
- The footer's "สมัครสมาชิก" (`/login?mode=signup`) is rendered only for guests.
- The login page switches to sign-up on every navigation to `?mode=signup`, including clicking the same link while already on that URL after switching to the login tab (key the effect on the location, not only on the param value). The root cause is confirmed in the browser before the fix.

### Cart and Favorites gating
- A single "require Member" action: when there is no user, navigate to `/login?redirect=<current path + search>` (in-app navigation, no confirmation dialog). The favorite toggle and add-to-cart both use it. The existing SweetAlert prompt in Favorites is removed.
- The Cart's storage key includes the user id (`stb_cart_v1:<userId>`). With no user the Cart is empty and `addItem` is a no-op. On login the Cart loads that user's key; on logout it switches to empty without deleting the stored Cart. The old unscoped `stb_cart_v1` key is discarded, since a guest cart no longer exists.
- `/favorites` is wrapped in `RequireAuth`. The footer and mobile menu hide the Favorites link for guests.
- After login, nothing is added automatically. The shopper is returned to the page they came from.

### Language
- Audit every customer-facing page for text that doesn't re-render on `languageChanged`: strings read at module scope or through `i18n.t` outside render, memoised values without the language in their dependencies, and product text helpers. Fix each so a language switch updates the whole page with no reload. Admin screens stay English.
- The language detector keeps persisting the choice (localStorage), and `<html lang>` follows the current language.

### Admin dashboard
- The admin tabs bar keeps horizontal scrolling but hides its scrollbar (a scrollbar-hiding utility on that element only).
- The Customers tab is renamed **Members**, following `CONTEXT.md`.
- `GET /admin/stats` also returns `products_by_category: Record<Category, number>` (active Products) and orders by status. The low-stock list keeps threshold Stock ≤ 2, active Products only, ascending.
- Overview layout: KPI tiles → [donut: orders by Order Status | bar: Products per Category] → horizontal bar: low stock → daily revenue. Charts use chart.js (already a dependency) with the existing `tokenColor` theme bridge. Each chart has a table alternative and an empty state. Status colours and labels come from the shared order-status module so they match the Orders tab.

### Pagination (10 per page, server-side)
- Orders, Products & stock and Members request `page` and `limit=10`, and read `{ rows, total, page, limit }`. Every list endpoint returns `total`: the admin products list switches from an unpaged array to the paged shape with an exact count, filtered by `active=true|false` and search. One shared pager component shows previous/next and "หน้า X / Y · ทั้งหมด N รายการ". Changing search or filters resets to page 1; mutations refetch the current page.

### Product active switch
- Each row's status badge becomes an accessible switch (`role="switch"`, labelled with the product name) calling the existing product PATCH with `{ is_active }`. The update is optimistic and rolls back with an error toast on failure. The trash/deactivate button is removed. Filter options: ทั้งหมด / เปิดใช้งาน / ปิดใช้งาน.

### Members: create and edit role
- New `POST /admin/customers` (admin only): body `{ full_name, email, phone?, role ∈ {user, admin} }`, validated with the existing validator. It invites through Supabase Auth admin (`inviteUserByEmail`, redirecting to the reset-password page so the Member sets a password), then upserts the profile with name, phone and role. Responses: 201 with the profile, 409 when the email already exists, 400 on invalid input. Each create is logged like role changes.
- Pencil icon per row (hidden on the signed-in Admin's own row) opens a modal: name, email, phone, joined date and order count read-only, plus a role select. Save calls the existing `PATCH /admin/customers/:id/role`, which already refuses self-changes. The Promote/Demote button is removed.

### Glossary
- `CONTEXT.md` already records **Cart** (signed-in Customers only, per account on device), **Favorite** and **Member**. The code and admin UI use these terms.

## Testing Decisions

- Good tests drive the app the way a person does: render the real `AppShell` at a URL, click and type through Testing Library, and assert on what's visible (roles, labels, Thai text from the shipped locale). Tests never assert on component internals, state, or storage keys except where storage is the behaviour (a Cart surviving logout).
- **Frontend seam (one):** `renderApp` in the test helpers, with `api` and `supabaseClient` mocked as in `SitePages.test.tsx`. Extend it to accept a signed-in Member (Customer or Admin) through the mocked Supabase session.
  - Routing: `/` shows the hero and product grid. `/products?category=beetle` lands on `/` with the filter applied. `/about` shows promises and facts and no contact block. The navbar has no "หน้าแรก".
  - Navbar per role: guest / Customer / Admin see the agreed entries. No Package icon.
  - Sign-up link: guests reach the sign-up form, also when clicking from `/login` after switching tabs. Members don't see the link.
  - Gating: a guest clicking heart or add-to-cart ends on `/login?redirect=…`. A guest sees no cart or heart icons. `/favorites` redirects. A Customer's Cart survives logout/login, and a second user sees an empty Cart.
  - Language: after switching to EN (an i18n instance loaded with both locales), the shop page shows no Thai UI strings, and a product shows its English name.
  - Admin: Overview renders each chart's table view from a mocked `/admin/stats`, including empty states. Lists request `limit=10` and show the pager text. A search resets to page 1. The product switch sends `is_active` and rolls back on error. Creating a Member posts the right body and shows the 409 message. The pencil is absent on your own row, and saving a role calls the role endpoint.
- **Backend seam:** HTTP-level tests in the existing `routes.test.js` style: the new `POST /admin/customers` requires an admin session and rejects invalid bodies before touching Supabase.
- Prior art: `SitePages.test.tsx`, `Checkout.test.tsx` and `OrderDetail.test.tsx` (frontend). `backend/test/unit/routes.test.js` and `validate.test.js` (backend).
- Visual checks (card border, hero height, hidden scrollbar, chart look in light/dark, phone width) are verified in the browser preview, not in Jest.

## Out of Scope

- Translating the Admin screens (they stay English).
- Storing the Cart in the database or syncing it across devices.
- Adding a Product automatically after a guest logs in.
- Editing a Member's name, email, phone or addresses from the admin (role only).
- Deleting Members or Products (deactivation only).
- New analytics beyond the agreed charts (e.g. best sellers, conversion).
- Changing the low-stock threshold or making it configurable.

## Further Notes

- `GuestRoute` sends signed-in users from `/login` to `/`, which now means the shop. That's still the right place.
- Removing the guest Cart changes behaviour for anyone with a stored guest cart today. That's accepted: the old key is discarded.
- The invitation flow depends on Supabase Auth's email sending and redirect URL allow-list. The reset-password URL must be allowed in the Supabase project.
- Many internal links point to `/products` today. The redirect keeps them working, but they should be updated so the URL bar doesn't flicker.
