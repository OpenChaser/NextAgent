/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sidebar: {
          bg: '#f5f5f5',
          active: '#e8e8e8',
          hover: '#ebebeb',
        },
        primary: {
          blue: '#3b82f6',
          green: '#22c55e',
        }
      },
    },
  },
  plugins: [],
}
