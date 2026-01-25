/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          500: 'var(--primary)',
        },
        'background-light': 'var(--background-light)',
        'background-dark': 'var(--background-dark)',
        'surface-dark': 'var(--surface-dark)',
      },
    },
  },
  plugins: [],
}
