# 07: Admin-managed Categories

**What to build:** Categories live in their own table (slug fixed at creation, Thai + English name, order, system flag) seeded with the four existing ones; beetle is the system Category (renamable, never deletable). A Categories tab in Admin adds, renames, reorders and deletes them; deleting one that still has products is refused with the count. The shop's Category chips and the product form follow this list. See ADR 0005.

**Blocked by:** None (can start immediately)

**Status:** done (2026-10-11, uncommitted)

- [x] Table + FK from products; CHECK constraint replaced; system row cannot be deleted
- [x] Public list endpoint; admin create / update / reorder / delete with 409s
- [x] Slug from English name, unique, never changes on rename
- [x] Admin Categories tab; shop chips and product form use the API list in the current language
- [x] DB, route and page tests
