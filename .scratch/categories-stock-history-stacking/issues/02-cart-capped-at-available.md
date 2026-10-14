# 02: Cart never holds more than Available

**What to build:** A Customer can never put more of a product in their Cart than is Available, whichever way they add it (card, product detail, drawer stepper, Cart page). If Available dropped since they added it, opening the Cart lowers the quantity and tells them. This is a bug: find the path that escapes the existing cap first, with a failing test.

**Blocked by:** None (can start immediately)

**Status:** done (2026-10-11, uncommitted)

- [x] Root cause identified and noted
- [x] Adding beyond Available is impossible from every entry point; a message says why
- [x] A product with Available 0 cannot be added
- [x] Stale quantities are lowered to current Available when the Cart opens, with a note
- [x] Test covers the escape path that used to exceed Available
