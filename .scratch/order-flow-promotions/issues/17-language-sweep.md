# 17: Language sweep — everything in Thai or English

**What to build:** In Thai every label, button, status, message, date and notification is Thai (except the logo); in English everything is English. Product and Promotion names use the localized field with Thai fallback; Cancel Reasons and Admin Notes show as entered. A test fails when a key exists in one locale but not the other.

**Blocked by:** 01–15

**Status:** done

- [x] No hard-coded user-facing strings left in pages and components
- [x] Dates formatted per locale
- [x] Locale-parity test green
