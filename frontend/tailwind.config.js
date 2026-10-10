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
        danger: 'oklch(var(--danger) / <alpha-value>)'
      },
      fontFamily: {
        display: ['"Noto Serif Thai"', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans Thai"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      }
    },
  },
  plugins: [],
}
