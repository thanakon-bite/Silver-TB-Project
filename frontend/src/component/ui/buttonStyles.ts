/**
 * The one primary action on a screen: solid accent-strong (passes 4.5:1 with accent-ink in both modes),
 * no gradient or glow. The label never wraps; keep it short.
 */
export const primaryButton =
  'inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-accent-strong px-5 py-3.5 font-semibold text-accent-ink ' +
  'transition-[filter,transform] duration-150 hover:brightness-95 active:translate-y-px motion-reduce:transition-none motion-reduce:active:translate-y-0 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong ' +
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100';
