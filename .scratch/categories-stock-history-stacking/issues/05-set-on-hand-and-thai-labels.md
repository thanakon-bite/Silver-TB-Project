# 05: Admin sets On Hand to a count; Thai labels

**What to build:** On the stock screen one adjust action opens a dialog prefilled with the current On Hand. The Admin types the counted number and an optional note. A number below the units Reserved (On Hand - Available) is refused with the minimum shown. Columns read คงคลัง / พร้อมขาย in Thai (On Hand / Available in English); "Stockmove" no longer appears.

**Blocked by:** None (can start immediately)

**Status:** done (2026-10-11, uncommitted)

- [x] Stock endpoint takes a target On Hand and optional note; refuses below Reserved
- [x] DB function sets On Hand (and Available by the same difference) atomically
- [x] Dialog prefilled with current On Hand, min = Reserved, has note field
- [x] Thai labels on the stock screen
- [x] DB test (set up, set down, refused below Reserved) and route test
