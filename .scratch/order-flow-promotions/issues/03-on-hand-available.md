# 03: On Hand / Available / In Transit stock

**What to build:** Each product has On Hand and Available (ADR 0003). Creating an order takes Available; any cancellation returns it exactly once; Confirmed reduces On Hand exactly once. An Admin receives stock (adds to both) and adjusts it (never below zero, Available never above On Hand). The admin stock screen shows Onhand, Stockmove (Available) and In Transit; shoppers see Available. Migration 005 sets Available = old stock and On Hand = old stock + units in open orders.

**Blocked by:** 02

**Status:** done

- [x] Create / cancel / confirm move the right number exactly once
- [x] Receive and adjust stock work and refuse invalid results
- [x] The admin stock screen shows Onhand, Stockmove and In Transit
- [x] Shop pages and the product API show Available only
- [x] Data conversion verified in the migration test
