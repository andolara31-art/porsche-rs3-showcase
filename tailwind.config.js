/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        racing: '#D5001C',
        titanium: '#8C8C8C',
        dark: '#1A1A1A',
      },
      fontFamily: {
        condensed: ['Oswald', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
        sans: ['Space Grotesk', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

