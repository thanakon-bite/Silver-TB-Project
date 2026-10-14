# Two stock numbers; On Hand drops only when an order is Confirmed

Each product keeps **On Hand** (units the shop is still responsible for) and **Available** (units that can still be ordered, the number shoppers see). Creating an order takes Available; cancelling gives it back; receiving stock adds to both; only **Confirmed** (customer, Admin, or 7 days after Shipping) takes units out of On Hand. We chose Confirmed over Shipping because a live beetle in transit is still the shop's problem until it arrives (the Live Arrival Guarantee may send a replacement), so On Hand should keep counting it.

## Consequences

- On Hand is not what sits on the shelf while orders are in transit. The stock screen shows **In Transit** (units in Shipping orders) so a physical count reconciles as On Hand − In Transit.
- Revenue also counts only Confirmed orders, so an order that is never confirmed by the customer must be auto-confirmed (7 days after Shipping) or On Hand and Revenue would drift forever.
