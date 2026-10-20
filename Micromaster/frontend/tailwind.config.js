/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: '#F5F4EE',
        slate: {
          900: '#0F2133',
          800: '#1A2D44',
          700: '#243A55',
        },
        lime: {
          400: '#CCFF00',
          500: '#C1EF28',
        },
        terracotta: {
          400: '#F09163',
          500: '#E07A45',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
};
