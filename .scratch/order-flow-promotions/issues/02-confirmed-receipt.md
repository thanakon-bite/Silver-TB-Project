# 02: Confirmed — customer confirms receipt

**What to build:** On a Shipping order the Customer can press "ได้รับสินค้าแล้ว"; an Admin can confirm on the customer's behalf; orders still Shipping 7 days after shipping are confirmed automatically by the background job. The timeline shows when and by whom (customer / admin / auto) the order was confirmed.

**Blocked by:** 01

**Status:** done

- [x] A Customer can confirm only their own Shipping order
- [x] An Admin can confirm any Shipping order
- [x] The background job confirms Shipping orders older than 7 days, idempotently
- [x] The order detail timeline shows the confirmed time and who confirmed
- [x] Tests at DB, HTTP and frontend seams
