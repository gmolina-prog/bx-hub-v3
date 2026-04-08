/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        charcoal: '#2D2E39',
        violet: {
          DEFAULT: '#5452C1',
          50:  '#F4F3FE',
          100: '#E8E7FC',
          200: '#D1CEF9',
          300: '#BAB6F6',
          400: '#7C7AD9',
          500: '#5452C1',
          600: '#4341A8',
          700: '#35347F',
          800: '#282756',
          900: '#1A1A3D',
        },
      },
      fontFamily: {
        sans: ['Montserrat', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
