# 12: Notify every Customer when a Promotion starts

**What to build:** When a Promotion's start time passes, every non-deactivated Customer gets one notification naming it (in their language); clicking it opens the products page.

**Blocked by:** 05, 10

**Status:** done

- [x] The background job announces each started Promotion exactly once
- [x] The notification text uses the Promotion's localized name
- [x] Tests at DB and frontend seams
