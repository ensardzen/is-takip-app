/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // Bu satır, React dosyalarımızı dahil ediyor
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}