# Categories (and beetle Families) are Admin-managed; `beetle` is a locked system Category

Migration 003 fixed Category to four values (`beetle`, `food`, `log`, `gear`) by a CHECK constraint. Admins now need to add, rename, reorder and delete Categories, and keep the list of beetle Families, without a code change. Categories move to their own table with Thai and English names and an order.

Several rules hang off the beetle Category: Beetle Attributes, the Family filter and the Mon–Wed Shipping Day. We considered a per-Category "live animal" flag that would carry those rules to any Category, but chose to lock `beetle` as the one system Category (renamable, never deletable) because the shop sells only one kind of live animal and the flag would make every rule depend on configuration.

## Consequences

- A Category or Family that still has products cannot be deleted.
- Each Category gets a slug from its English name at creation, which never changes, so `?category=` links keep working after a rename. The four original Categories keep their current slugs.
- A beetle's Family is chosen from the Admin's list instead of typed freely; existing free-text Families seed that list.
