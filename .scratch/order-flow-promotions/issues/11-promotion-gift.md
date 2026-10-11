# 11: Promotion — Gift

**What to build:** A Promotion can give a Gift: every X paid covered units earn Y free units, from products the Admin ticks (including products not for sale). When several gifts are offered the Customer picks one in the Cart. Gifts take Available, appear on the order at zero price, and when none is Available the Cart shows "ของแถมหมด" and the order still goes through.

**Blocked by:** 10

**Status:** done

- [x] The Admin sets the gift rule and ticks gift products
- [x] Pricing computes repeated gifts and handles out-of-stock gifts
- [x] The Customer's gift choice in the Cart is carried to the order
- [x] Gift lines reserve and release Available, and are not sent to Stripe as charged lines
- [x] Tests at DB, unit and frontend seams
