/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'vnpost-orange': '#F9A51A',
        'vnpost-yellow': '#FFB900',
        'vnpost-blue': '#0054A6',
        'vnpost-blue-dark': '#003E7E',
        'vnpost-gray': '#E5E7EB',
        'vnpost-bg': '#F3F4F6'
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
