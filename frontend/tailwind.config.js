/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Role tokens (see src/index.css). Values switch with the .dark class.
        paper: 'oklch(var(--paper) / <alpha-value>)',
        sunken: 'oklch(var(--sunken) / <alpha-value>)',
        ink: 'oklch(var(--ink) / <alpha-value>)',
        muted: 'oklch(var(--muted) / <alpha-value>)',
        line: 'oklch(var(--line) / <alpha-value>)',
        accent: {
          DEFAULT: 'oklch(var(--accent) / <alpha-value>)', // decoration only: below 3:1 on paper in light mode
          strong: 'oklch(var(--accent-strong) / <alpha-value>)', // buttons, links, focus
          ink: 'oklch(var(--accent-ink) / <alpha-value>)', // text on accent-strong
        },
        success: 'oklch(var(--success) / <alpha-value>)',
        danger: 'oklch(var(--danger) / <alpha-value>)',
        // Over photos only; fixed in both themes.
        scrim: 'oklch(var(--scrim) / <alpha-value>)',
        'on-scrim': 'oklch(var(--on-scrim) / <alpha-value>)',
      },
      fontFamily: {
        display: ['"Noto Serif Thai"', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans Thai"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      // Hero slides: a slow push-in on the photo while it shows, and the words rising in.
      keyframes: {
        'hero-zoom': { from: { transform: 'scale(1)' }, to: { transform: 'scale(1.08)' } },
        'hero-rise': { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        'hero-zoom': 'hero-zoom 6.5s ease-out forwards',
        'hero-rise': 'hero-rise 0.7s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
}
