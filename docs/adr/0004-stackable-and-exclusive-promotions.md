# Promotions are Stackable or Exclusive; an Order uses one Exclusive or all Stackable together

We first ruled that Promotions never stack: each order line got only the single Promotion worth most to the customer. The shop now wants some offers to combine, so each Promotion is marked **Stackable** or **Exclusive**. We rejected "everything stacks" because an Admin could not then run a deep one-off offer without it compounding with every other running Promotion.

**Amended 2026-10-11:** the choice is made once for the whole Order, not per order line. The Order uses one option: either one Exclusive Promotion, or every Stackable Promotion together. Each product gets the option's Promotions that cover it, and a product the option does not cover pays the normal price. The Cart pre-selects the option worth most to the whole Order (Gifts counted at their price). The customer can pick another option, once for the Order, on the Cart page or on a product page. The first version gave each line its own option. The owner found that confusing in the Cart ("one card per product") and asked for one Promotion per order instead.

## Consequences

- Stacked percentage Discounts compound on the already-reduced price (10% then 5% is 14.5%, not 15%); baht Discounts come straight off; a unit price never goes below zero. Compounding keeps the result independent of the order the Promotions are applied in for percentages, and stops two large percentages from making a unit free.
- Every Gift of every applied Promotion is earned.
- An order counts one Redemption per Promotion it uses. A Promotion the customer can no longer redeem drops out of the stack; the others still apply.
- The "buy N more" hints in the Cart are only for the Promotions of the option the Order uses.
- The server re-checks the pick at price-preview and order creation. A pick that is no longer on offer falls back to the best option.
- Promotions that existed before this change are Exclusive, which keeps their behaviour unchanged; new Promotions default to Exclusive.
