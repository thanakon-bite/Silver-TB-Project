# Promotions are Stackable or Exclusive; an order line gets one Exclusive or all Stackable together

We first ruled that Promotions never stack: each order line got only the single Promotion worth most to the customer. The shop now wants some offers to combine, so each Promotion is marked **Stackable** or **Exclusive**. An order line gets either one Exclusive Promotion or every Stackable Promotion that covers it, whichever is worth more; the Cart pre-selects that and lets the customer pick another option per line (radio). We rejected "everything stacks" because an Admin could not then run a deep one-off offer without it compounding with every other running Promotion.

## Consequences

- Stacked percentage Discounts compound on the already-reduced price (10% then 5% is 14.5%, not 15%); baht Discounts come straight off; a unit price never goes below zero. Compounding keeps the result independent of the order the Promotions are applied in for percentages, and stops two large percentages from making a unit free.
- Every Gift of every applied Promotion is earned.
- An order counts one Redemption per Promotion it uses. A Promotion the customer can no longer redeem drops out of the stack; the others still apply.
- Promotions that existed before this change are Exclusive, which keeps their behaviour unchanged; new Promotions default to Exclusive.
