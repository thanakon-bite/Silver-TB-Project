# LINE order alerts go only to recipients named in env vars

Paid-order alerts contain customer names, phone numbers and addresses, so they are pushed (LINE Messaging API) only to `LINE_OWNER_USER_ID` plus optional `LINE_ADMIN_TARGET_IDS`. We removed the earlier behaviour that auto-targeted whichever LINE group the bot was last invited to: anyone able to add the Official Account to their own group could have redirected every customer's address to themselves. LINE Notify is discontinued and not used.

**Amended 2026-10-11:** Admins can also pick recipients in the shop, without a server change. The webhook now stores each LINE user who follows the Official Account or messages it 1:1 (never a group or room), and the Admin's Payments & LINE page lists them with a tick each. Only ticked friends who still follow get alerts, along with the env recipients. Following the OA grants nothing by itself, so the original risk (anyone redirecting customers' addresses to themselves) stays closed: a person must be ticked by an Admin, who already sees that data. LINE cannot push to a "LINE ID" (the searchable handle), only to the `U…` user id the webhook supplies, which is why Admins pick from a list instead of typing an id.

## Consequences

- The webhook URL must be set in LINE Developers for friends to appear; friends from before that appear after their next message to the OA.
- An unfollow stops that friend's alerts at once; following again brings them back, still ticked.
- Each recipient costs one push message per alert against the OA's monthly quota.
