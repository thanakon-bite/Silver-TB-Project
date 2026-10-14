# 09: Members paged by 10; create by invite; edit role with a pencil

**What to build:** Members shows 10 rows per page. "สร้างสมาชิก" takes name, email, phone and role (default user) and sends an invitation email so the Member sets their own password. A duplicate email shows a clear error. A pencil on each row (not your own) opens a modal with read-only profile details and a role select, which saves through the existing role endpoint.

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] `POST /admin/customers` requires an Admin and validates the body before touching Supabase
- [ ] Create posts the right body; 409 shows "email already registered"
- [ ] No pencil on your own row; saving a role calls the role endpoint and refreshes the row
