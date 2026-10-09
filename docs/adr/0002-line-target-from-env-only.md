# LINE order alerts go only to recipients named in env vars

Paid-order alerts contain customer names, phone numbers and addresses, so they are pushed (LINE Messaging API) only to `LINE_OWNER_USER_ID` plus optional `LINE_ADMIN_TARGET_IDS`. We removed the earlier behaviour that auto-targeted whichever LINE group the bot was last invited to: anyone able to add the Official Account to their own group could have redirected every customer's address to themselves. LINE Notify is discontinued and not used.
