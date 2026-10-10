# Silver Thief Bug

An online shop selling live beetles and the goods needed to keep them (food, logs/substrate, gear) to customers in Thailand.

## Language

### Catalogue

**Product**:
Anything listed in the shop, live beetle or goods. One kind of thing, with a **Category**.
_Avoid_: Item (reserved for order lines), listing

**Category**:
The kind of product: `beetle`, `food`, `log` (logs and substrate) or `gear`.
_Avoid_: Type, family (when meaning category)

**Beetle Attributes**:
The facts that describe a live beetle product: family, species, locality, sex, stage and size.
_Avoid_: Specs, details

**Family**:
The beetle group shown to shoppers, e.g. Rhinoceros, Stag, Flower. A Beetle Attribute, not a Category.

**Sex**:
`male`, `female`, `pair` (1 male + 1 female), `trio` (1 male + 2 females) or `unsexed`.

**Stage**:
Life stage of a live beetle: `egg`, `L1`, `L2`, `L3` (larval instars), `pupa`, `adult`.

**Stock**:
How many units of a product can still be sold. Many beetles are one-of-a-kind (stock 1).
_Avoid_: Inventory count, quantity (reserved for order lines)

**Reservation**:
Stock held for a **Pending** order while the customer pays. Released when the order is cancelled or expires.
_Avoid_: Hold, lock

### Ordering

**Cart**:
The products a shopper has picked but not yet ordered (ตะกร้า), kept on their own device. A Cart holds no stock; a **Reservation** starts only when the customer continues to payment and an Order is created.
_Avoid_: Basket, bag; never call an Order a cart

**Order**:
A customer's purchase of one or more products, shipped to one address.
_Avoid_: Purchase, transaction, cart (the cart is pre-order)

**Order Item**:
One product line in an order, with the price and name as they were at checkout.
_Avoid_: Line item, cart item

**Shipping Fee**:
The flat delivery charge (ค่าจัดส่ง) added to every order's total. When it is zero, customers see "free" (ฟรี).
_Avoid_: Shipping (alone, which can mean the address or the act of shipping), delivery cost

**Order Number**:
The human-readable order reference shown to customers and the owner (e.g. `STB-261010-00002`).
_Avoid_: Order ID (the internal UUID)

**Order Status**:
Where an order is in fulfilment: **Pending** → **Paid** → **Shipped** (→ **Delivered**), or **Cancelled**. Customers see each status in Thai, named on each entry below.

**Pending**:
Created, stock reserved, waiting for payment. Customers see รอชำระเงิน.

**Paid**:
Stripe confirmed the payment through a verified webhook. Only Stripe can make an order Paid; a person never can. Customers see ชำระแล้ว.
_Avoid_: Confirmed

**Shipped**:
Handed to a carrier; has a **Tracking Number**. Customers see จัดส่งแล้ว.

**Delivered**:
Optional final step after Shipped, set by the admin. Customers see ได้รับสินค้าแล้ว.

**Cancelled**:
Ended without fulfilment. Reserved stock is returned; a Paid order must be refunded first. Customers see ยกเลิกแล้ว, or ยกเลิกและคืนเงินแล้ว when it was refunded.

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
Money returned to the customer through the original Stripe payment. A Paid order not yet Shipped can be refunded in full; after Shipped, only under the Live Arrival Guarantee, for unopened gear returned within 7 days (customer pays the return postage, refunded once the shop receives it), or for goods that arrived damaged or wrong. Food and logs/substrate are not returnable otherwise. Live beetles are never refunded for a change of mind.
_Avoid_: Return (which is the parcel coming back, not the money)

### Customers and addresses

**Customer**:
A signed-in shopper with the `user` role.
_Avoid_: Client, buyer, account

**Admin**:
A person with the `admin` role who runs the shop.
_Avoid_: Owner (unless meaning the LINE recipient), staff

**Owner**:
The person who receives the LINE message for every Paid order.

**Saved Address**:
A shipping address a customer keeps in their account; at most one is the **Default Address**.

**Shipping Address Snapshot**:
The copy of the address stored on an order at checkout, unaffected by later edits to Saved Addresses.

**Province / District / Subdistrict**:
Thai administrative levels จังหวัด / อำเภอ (เขต) / ตำบล (แขวง). A subdistrict determines the postal code.
_Avoid_: Amphoe, tambon, city, state
