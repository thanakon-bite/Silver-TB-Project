/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        silver: {
          light: '#F8F9FA',
          DEFAULT: '#E5E7EB',
          medium: '#9CA3AF',
          dark: '#4B5563',
          metallic: '#C0C0C0', // Classic silver
        },
        white: '#FFFFFF',
        orange: {
          light: '#FFD8A8',
          DEFAULT: '#FF922B', // More vibrant orange
          dark: '#E67E22',
          premium: '#FF6B00',
        },
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
      },
      backgroundImage: {
        'premium-gradient': 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        'orange-gradient': 'linear-gradient(135deg, #FF922B 0%, #FF6B00 100%)',
      }
    },
  },
  plugins: [],
}
