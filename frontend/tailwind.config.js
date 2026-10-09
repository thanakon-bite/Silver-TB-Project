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
        accent: {
          gold: '#FFD700',
          dark: '#111827',
        }
      },
      backgroundImage: {
        'premium-gradient': 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        'orange-gradient': 'linear-gradient(135deg, #FF922B 0%, #FF6B00 100%)',
      }
    },
  },
  plugins: [],
}
