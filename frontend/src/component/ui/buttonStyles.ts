const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong';

/**
 * The one primary action on a screen: solid accent-strong (passes 4.5:1 with accent-ink in both modes),
 * no gradient or glow. The label never wraps; keep it short.
 */
export const primaryButton =
  'inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-accent-strong px-5 py-3.5 font-semibold text-accent-ink ' +
  'transition-[filter,transform] duration-150 hover:brightness-95 active:translate-y-px motion-reduce:transition-none motion-reduce:active:translate-y-0 ' +
  `${focusRing} ` +
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100';

/** The same voice at its natural width, for actions that sit in a row (hero, empty states, product cards). */
export const primaryButtonInline = primaryButton.replace('w-full', 'w-auto');

/** Compact solid button for repeated actions, e.g. "add" on every product card. 40px tall. */
export const compactButton =
  'inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-accent-strong px-3.5 text-sm font-semibold text-accent-ink ' +
  'transition-[filter] duration-150 hover:brightness-95 motion-reduce:transition-none ' +
  `${focusRing} disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100`;

/** A bordered, quiet button: the safe choice beside a primary, or a secondary action on its own. */
export const secondaryButton =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink ' +
  'transition-colors hover:border-muted motion-reduce:transition-none ' +
  `${focusRing} disabled:cursor-not-allowed disabled:opacity-50`;

/**
 * Destructive, design.md: never solid. dangerLink is the quiet way in; it opens an inline confirmation
 * whose [keep] is a secondaryButton (focused) and whose [confirm] is a dangerButton.
 */
export const dangerLink =
  'inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-muted underline-offset-4 hover:text-danger hover:underline ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-strong';

export const dangerButton =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-danger/40 px-4 py-2.5 text-sm font-semibold text-danger ' +
  'transition-colors hover:bg-danger/5 motion-reduce:transition-none ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:cursor-not-allowed disabled:opacity-60';

/** Square icon button, 40×40 (44 with the hit area of its padding on touch). Always pair with aria-label. */
export const iconButton =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-sunken hover:text-ink motion-reduce:transition-none ' +
  `${focusRing} disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent`;

/** Secondary text action in accent-strong, underline on hover (e.g. "เปลี่ยนที่อยู่"). */
export const textLink = 'font-medium text-accent-strong underline-offset-4 hover:underline';

/** Quiet navigation link (back links, footer links). */
export const quietLink = 'text-muted underline-offset-4 hover:text-ink hover:underline';

/** A filter/category choice. Active is marked with accent-strong, never with fill alone. */
export const chip = (active: boolean) =>
  `inline-flex h-9 items-center whitespace-nowrap rounded-lg border px-3.5 text-sm font-medium transition-colors motion-reduce:transition-none ${focusRing} ${
    active ? 'border-accent-strong bg-accent-strong/10 text-accent-strong' : 'border-line text-muted hover:border-muted hover:text-ink'
  }`;
