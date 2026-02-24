/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['selector', '[data-mode="dark"]'],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#EAFF00",       // Neon Yellow
        "primary-hover": "#D4E600",
        secondary: "#0F172A",     // Slate 900
        bg: {
          body: "#FFFFFF",
          card: "#F8FAFC",
          input: "#E2E8F0"
        }
      },
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
      }
    },
  },
  plugins: [],
}