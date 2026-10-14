# 08: Admin-managed beetle Families

**What to build:** The Categories tab also manages the list of Families, seeded from Families already typed on products. The product form picks a beetle's Family from the list. Renaming a Family renames it on every product; deleting one still used is refused.

**Blocked by:** 07

**Status:** done (2026-10-11, uncommitted)

- [x] Family table seeded from existing products
- [x] Public list; admin create / rename (cascades to products) / delete (409 when used)
- [x] Product validation requires a listed Family for beetles
- [x] Family section in the Categories tab; product form dropdown
- [x] Route and page tests
