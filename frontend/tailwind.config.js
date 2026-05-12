/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: { 50:'#fffbeb', 100:'#fef3c7', 400:'#fbbf24', 500:'#f59e0b', 600:'#d97706' },
        brand: { 900:'#0f172a', 800:'#1e293b', 700:'#334155', 600:'#475569' },
      },
    },
  },
  plugins: [],
}
