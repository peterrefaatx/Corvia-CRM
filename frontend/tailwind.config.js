/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Satoshi', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontWeight: {
        light: '300',
        normal: '400',
        medium: '500',
        bold: '700',
        black: '900',
      },
      colors: {
        primary: {
          50: '#e8eef7',
          100: '#d4e0f0',
          200: '#c0d2e8',
          300: '#acc3e1',
          400: '#98b5d9',
          500: '#8FABD4',
          600: '#8FABD4',
          700: '#7a98c4',
          800: '#6585b4',
          900: '#5072a4',
        },
        blue: {
          50: '#e8eef7',
          100: '#d4e0f0',
          200: '#c0d2e8',
          300: '#acc3e1',
          400: '#98b5d9',
          500: '#8FABD4',
          600: '#8FABD4',
          700: '#7a98c4',
          800: '#6585b4',
          900: '#5072a4',
        }
      }
    },
  },
  plugins: [],
}