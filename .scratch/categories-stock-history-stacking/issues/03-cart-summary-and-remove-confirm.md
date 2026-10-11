# 03: Cart summary shows item subtotal; removing asks first

**What to build:** The Cart summary reads item subtotal (before discounts) -> discount -> Shipping Fee -> total. Removing a product, or lowering its quantity to zero, asks for confirmation with SweetAlert.

**Blocked by:** None (can start immediately)

**Status:** done (2026-10-11, uncommitted)

- [x] Item subtotal line present, before the discount line
- [x] Remove button and stepper-to-zero both open a confirm; cancel keeps the line
- [x] TH and EN strings added
- [x] Page test for summary order and both confirm paths
