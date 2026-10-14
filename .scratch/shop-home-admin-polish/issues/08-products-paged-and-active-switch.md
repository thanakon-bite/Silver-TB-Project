# 08: Products & stock paged by 10 with an on/off switch

**What to build:** Products & stock shows 10 rows per page with the shared pager. Each row has an on/off switch (replacing the trash icon) that saves at once and rolls back on error. A filter shows all / active / inactive.

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] The admin products endpoint returns a paged shape with a total, and filters by active state
- [ ] The switch sends `is_active` and rolls back with an error on failure
- [ ] The filter narrows the list and resets to page 1
