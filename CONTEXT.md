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

**Order**:
A customer's purchase of one or more products, shipped to one address.
_Avoid_: Purchase, transaction, cart (the cart is pre-order)

**Order Item**:
One product line in an order, with the price and name as they were at checkout.
_Avoid_: Line item, cart item

**Order Number**:
The human-readable order reference shown to customers and the owner (e.g. `STB-261010-00002`).
_Avoid_: Order ID (the internal UUID)

**Order Status**:
Where an order is in fulfilment: **Pending** → **Paid** → **Shipped** (→ **Delivered**), or **Cancelled**.

**Pending**:
Created, stock reserved, waiting for payment.

**Paid**:
Stripe confirmed the payment through a verified webhook. Only Stripe can make an order Paid; a person never can.
_Avoid_: Confirmed

**Shipped**:
Handed to a carrier; has a **Tracking Number**.

**Delivered**:
Optional final step after Shipped, set by the admin.

**Cancelled**:
Ended without fulfilment. Reserved stock is returned; a Paid order must be refunded first.

**Tracking Number**:
The carrier's parcel reference entered by the admin when shipping.

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
