# 04: Cart and Favorites only for signed-in Customers

**What to build:** Guests see no cart or heart icons. Tapping heart or add-to-cart as a guest goes straight to login and returns to the same page afterwards. The Cart is kept per account on the device, so it survives logout/login and isn't visible to another user. `/favorites` requires login, and Favorites links are hidden from guests.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Guest heart / add-to-cart → `/login?redirect=<current page>`
- [ ] No cart/heart icons for guests (desktop and phone)
- [ ] A Customer's Cart comes back after logout and login; another user starts with an empty Cart
- [ ] `/favorites` redirects guests to login
