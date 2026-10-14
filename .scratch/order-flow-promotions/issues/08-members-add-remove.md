# 08: Members — add by invitation, remove or deactivate

**What to build:** On the admin Members page an Admin adds a Member by email, name and role; the Member receives an invitation email to set their own password. Removing a Member with no orders deletes them; one with orders is Deactivated (cannot sign in, orders kept). Removing yourself or the last Admin is refused. Removal asks for confirmation.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Add Member sends an invitation and creates the profile with the chosen role
- [x] Remove deletes or Deactivates according to order history
- [x] Deactivated Members are rejected by authentication
- [x] Self / last-Admin removal is refused
- [x] Tests at HTTP and frontend seams
