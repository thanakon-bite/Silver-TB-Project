# Silver Thief Bug

An online shop selling live beetles and the goods needed to keep them (food, logs/substrate, gear) to customers in Thailand.

## Language

### Catalogue

**Product**:
Anything listed in the shop, live beetle or goods. One kind of thing, with a **Category**.
_Avoid_: Item (reserved for order lines), listing

**Category**:
The kind of product (หมวดหมู่), and the first filter shoppers use. Admins add, rename, reorder and delete Categories, each with a Thai and English name; a Category that still holds products cannot be deleted. `beetle` is the one system Category: it can be renamed but never deleted, and only its products carry Beetle Attributes, a Family, and the Shipping Day limit.
_Avoid_: Type, family (when meaning category)

**Beetle Attributes**:
The facts that describe a live beetle product: family, species, locality, sex, stage and size.
_Avoid_: Specs, details

**Family**:
The beetle group shown to shoppers, e.g. Rhinoceros, Stag, Flower (วงศ์), and the second filter once shoppers pick the beetle Category. A Beetle Attribute, not a Category. Admins keep the list of Families; a beetle's Family is picked from it, and a Family still used by a product cannot be deleted.

**Sex**:
`male`, `female`, `pair` (1 male + 1 female), `trio` (1 male + 2 females) or `unsexed`.

**Stage**:
Life stage of a live beetle: `egg`, `L1`, `L2`, `L3` (larval instars), `pupa`, `adult`.

**On Hand**:
Units of a product the shop is still responsible for: in the warehouse, or on their way to a customer who has not yet confirmed receipt. Goes up only when an Admin receives stock; goes down only when an order becomes **Confirmed**. Shown in Thai as คงคลัง. An Admin changes it by setting a new count (never below the units Reserved), optionally with a note.
_Avoid_: Stock (alone), inventory count

**Available**:
Units of a product that can still be ordered, and the number shoppers see. Equals On Hand minus the units in orders that are neither Confirmed nor Cancelled. Goes down when an order is created, comes back when an order is Cancelled. Many beetles are one-of-a-kind (Available 1). Shown in Thai as พร้อมขาย. A Customer can never put more of a product in their Cart than is Available.
_Avoid_: Stock (alone), stock move / Stockmove (which suggests a movement record, not a balance)

**In Transit**:
Units in **Shipping** orders: still On Hand but no longer on the shelf. Shown on the stock screen so a physical count can be reconciled.

**Reservation**:
The Available units an order takes the moment it is created, held until it is Confirmed (when they leave On Hand) or Cancelled (when they return to Available).
_Avoid_: Hold, lock

**Stock History**:
A product's record of every **Stock Change** (ประวัติสต็อก), newest first, kept from the moment it was introduced; earlier changes are summed up in one opening entry.

**Stock Change**:
One entry in Stock History: the product being created, an Admin setting On Hand, an order being created (Available down), Cancelled (Available back) or Confirmed (On Hand down). Each says who or what caused it, when, the order if any, the note if any, and On Hand and Available after it.
_Avoid_: Stock move, movement (alone), adjustment (which is only the Admin kind)

### Ordering

**Cart**:
The products a signed-in Customer has picked but not yet ordered (ตะกร้า), kept on their own device under their account, so people sharing a device never see each other's Cart. Guests have no Cart. A Cart holds no stock; a **Reservation** starts only when the customer continues to payment and an Order is created, and at that moment the Cart is emptied: from then on the customer pays, or cancels, from the Order itself. It normally opens as a drawer over the current page. Its expand icon opens the Cart page (`/cart`), which shows the Cart in full, and the page's shrink icon brings the drawer back over the page it came from. That page is where the customer picks the Order's Promotion.
_Avoid_: Basket, bag; never call an Order a cart

**Favorite**:
A product a signed-in Customer has marked to come back to (รายการโปรด), kept with their account. Guests have no Favorites.
_Avoid_: Wishlist, saved item

**Order**:
A customer's purchase of one or more products, shipped to one address.
_Avoid_: Purchase, transaction, cart (the cart is pre-order)

**Order Item**:
One product line in an order, with the price and name as they were at checkout.
_Avoid_: Line item, cart item

**Shipping Fee**:
The delivery charge (ค่าจัดส่ง) added to an order's total, worked out by the **Shipping Rule** and kept on the order as it was at checkout. When it is zero, customers see "free" (ฟรี).
_Avoid_: Shipping (alone, which can mean the address or the act of shipping), delivery cost

**Shipping Rule**:
The shop's table that sets the Shipping Fee from how many paid units an order holds (Gifts don't count). Its **Shipping Tiers** run without gaps or overlaps from 1 unit, the last one open-ended ("N or more"). It may also set a **Free Shipping Threshold**: an item total, after discounts, at or above which the fee is zero.
_Avoid_: Shipping cost setting, delivery rule

### Promotions

**Promotion**:
A time-boxed offer an Admin sets up (โปรโมชั่น) with a Thai and optional English name, a start and end date (Thai time, both days included), the products it covers (all or a chosen list), and a **Discount**, a **Gift**, or both. Applied automatically, with no code to enter. A product may sit in several Promotions at once. Each Promotion is either **Stackable** (ใช้ร่วมกับโปรโมชั่นอื่นได้) or **Exclusive** (ใช้ได้เฉพาะโปรโมชั่นเดียว). An Order uses one option for all its products, either one Exclusive Promotion or all Stackable Promotions together; the Cart picks whichever benefits the customer most and lets them choose another, once for the whole Order. A Promotion a customer can no longer redeem is not offered or shown to them. Once anyone has redeemed a Promotion it can be ended but never deleted, and what it covers and gives is fixed from its start date.
_Avoid_: Promotion Plan, deal, coupon (no codes exist)

**Stackable**:
A Promotion that combines with every other Stackable Promotion in the same Order, on each product they cover: percentage Discounts apply one after another to the already-reduced price, baht Discounts come straight off, the price never goes below zero, and every Gift is earned.

**Exclusive**:
A Promotion that applies on its own, never together with another. An Order uses one option for all its products: one Exclusive Promotion, or every Stackable one together. Products the option does not cover pay the normal price.

**Best Promotion**:
The Promotion worth the most to a customer buying one unit (or, when none gives anything for one unit, at each one's lowest tier), a Gift valued at the gift's price shared over the units it takes to earn it. It is the one a product card shows.

**Discount**:
The price cut part of a Promotion, given as **Discount Tiers**: "buy N or more, get X% or X baht off each unit". Units of every product covered by the same Promotion count together, and only the highest tier reached applies.
_Avoid_: Sale price, markdown

**Gift**:
The free-goods part of a Promotion (ของแถม): every X paid units of covered products earn Y free units, repeatable. When the Admin ticks several gift products, the customer picks which one in the Cart. A gift product may be one not otherwise for sale. A Gift takes Available like any order line, appears on the order at zero price, and is simply left out when none is Available; the order still goes through.
_Avoid_: Freebie, bonus item

**Redemption**:
One use of a Promotion by one Customer, counted when the order is created and given back when that order is Cancelled. An order counts once for each Promotion it uses, however many lines or Stackable partners it shares. A Promotion may cap Redemptions per Customer, and cap how many different Customers may redeem it, or leave either unlimited.
_Avoid_: Usage, claim

**Order Number**:
The human-readable order reference shown to customers and the owner (e.g. `STB-261010-00002`).
_Avoid_: Order ID (the internal UUID)

**Order Status**:
The single field that says where an order is: **Awaiting Payment** → **Paid** → **Waiting Shipping** → **Shipping** → **Confirmed**, or **Cancelled**. There is no separate payment status. Customers and Admins see the same statuses, in Thai or English. Placing the order (สั่งซื้อ) is the first point on the order's timeline, not a status.

**Awaiting Payment**:
Created, units reserved, waiting for the customer to pay. Customers see รอชำระเงิน.
_Avoid_: Pending, Request Order

**Paid**:
Stripe confirmed the payment through a verified webhook. Only Stripe can make an order Paid; a person never can. Paid is the moment the Owner is alerted to pack the order; until that alert is automated the order moves straight on to Waiting Shipping. Customers see ชำระแล้ว.
_Avoid_: Paided, Confirmed

**Waiting Shipping**:
Paid and being packed, not yet handed to a carrier. Customers see รอจัดส่ง.

**Shipping**:
Handed to a carrier by an Admin, who must enter its **Tracking Number**. Customers see จัดส่งแล้ว.
_Avoid_: Shipped, Delivered

**Confirmed**:
The customer has received the order: they confirmed it, an Admin confirmed it for them, or 7 days passed after Shipping. The final step; only now do the units leave On Hand and the money count as **Revenue**. Customers see ได้รับสินค้าแล้ว.
_Avoid_: Delivered, Completed

**Cancelled**:
Ended without fulfilment, with a **Cancel Reason**. A customer may cancel only while Awaiting Payment; an Admin may cancel while Awaiting Payment, Paid or Waiting Shipping. For now a paid order is cancelled without a Refund (refunds paused, 2026-10-11): the money stays until the shop refunds it by hand in Stripe. Unpaid orders that run out of time to pay are cancelled too. Reserved units return to Available. Customers see ยกเลิกแล้ว, or ยกเลิกและคืนเงินแล้ว when it was refunded.

**Cancel Reason**:
Why an order was cancelled, shown to the customer. Required whenever an Admin cancels, written once in the Admin's own words; when time to pay runs out the system gives "Payment time expired" itself.

**Admin Note**:
The Admin's private note on an order, never shown to the customer.
_Avoid_: Remark, comment

**Revenue**:
The money the shop has actually earned: the totals customers paid (after discounts, including Shipping Fees) on Confirmed orders only.
_Avoid_: Sales (which may include unconfirmed orders)

**Notification**:
A message in a signed-in Member's bell (การแจ้งเตือน), in the site only. A Customer is notified when their order is Awaiting Payment, goes Shipping (with the carrier and Tracking Number), is still unconfirmed 3 days after Shipping (asking them to confirm receipt), is Confirmed by an Admin or automatically, or is Cancelled (with the Cancel Reason). Every Admin is notified when a customer confirms receipt or an order is confirmed automatically. Every active Member (Customers and Admins) is notified when a Promotion is announced (with its dates) and again when it starts, once only when both fall on the same day. A Member can delete any of their own Notifications.
_Avoid_: Alert (which means the LINE message to the Owner)

**Tracking Number**:
The carrier's parcel reference entered by the admin when shipping.

### Shipping and after-sale

**Shipping Day**:
A day on which live beetles are handed to a carrier: Monday to Wednesday only, so no parcel sits in a depot over a weekend. Goods (food, logs, gear) ship on any working day. The shop may postpone a Shipping Day for extreme heat or heavy rain and tells the customer first.
_Avoid_: Delivery day (the day the customer receives it)

**Live Arrival Guarantee**:
The shop's promise that a live beetle arrives alive (รับประกันถึงมือมีชีวิต). It covers death in transit only, proven by an uninterrupted unboxing video and reported within 2 hours of receiving the parcel. It is not a survival guarantee after arrival.
The shop sends a replacement of the same species at its own cost, or refunds the beetle's price when none is in Stock.
Not covered: a parcel delayed or returned because the customer was unavailable or gave a wrong address or phone, a late or broken unboxing video, or death after unboxing.
_Avoid_: Health guarantee, 30-day guarantee, DOA (in customer-facing text)

**Refund**:
Money returned to the customer through the original Stripe payment. Refunds are paused for now (2026-10-11): cancelling an order never refunds it automatically, and the shop refunds by hand in the Stripe Dashboard, which the shop then sees on the order; once Shipping, a refund is made by hand and only under the Live Arrival Guarantee, for unopened gear returned within 7 days (customer pays the return postage, refunded once the shop receives it), or for goods that arrived damaged or wrong. Food and logs/substrate are not returnable otherwise. Live beetles are never refunded for a change of mind.
_Avoid_: Return (which is the parcel coming back, not the money)

### Customers and addresses

**Customer**:
A signed-in shopper with the `user` role.
_Avoid_: Client, buyer, account

**Member**:
Anyone with an account, whatever their role: every Customer and every Admin. The admin's member list shows Members, not only Customers.
An Admin adds a Member by invitation (the Member sets their own password). Removing a Member who has orders **Deactivates** them (they can no longer sign in, their orders stay); one with no orders is deleted outright. The last Admin can never be removed.
_Avoid_: Customer (when admins are included), user (when meaning the person rather than the role)

**Admin**:
A person with the `admin` role who runs the shop.
_Avoid_: Owner (unless meaning the LINE recipient), staff

**Owner**:
The person who receives the LINE message for every Paid order and every order a customer confirms receiving, named in the server's settings. The **LINE Recipients** get the same messages.

**LINE Recipient**:
A friend of the shop's LINE Official Account whom an Admin ticked to receive the Owner's LINE messages (ผู้รับแจ้งเตือนทาง LINE). Any number can be ticked. Following the Official Account alone never makes someone a recipient, and a friend who unfollows stops receiving. Groups are never recipients.
_Avoid_: LINE ID (the searchable handle, which LINE cannot send to), subscriber

**Saved Address**:
A shipping address a customer keeps in their account; at most one is the **Default Address**.

**Shipping Address Snapshot**:
The copy of the address stored on an order at checkout, unaffected by later edits to Saved Addresses.

**Province / District / Subdistrict**:
Thai administrative levels จังหวัด / อำเภอ (เขต) / ตำบล (แขวง). A subdistrict determines the postal code.
_Avoid_: Amphoe, tambon, city, state
