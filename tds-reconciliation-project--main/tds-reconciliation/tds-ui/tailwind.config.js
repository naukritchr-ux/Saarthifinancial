/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          header: '#FFFFFF',
          primary: '#9B87F5',
          primaryHover: '#8572E0',
          secondary: '#B4A7F5',
          success: '#4ADE80',
          warning: '#FBBF77',
          error: '#F87A9E',
          pro: '#C084FC',
          card: '#FFFFFF',
          page: '#E8E4FF',
          border: '#E9E4FA',
          text: '#1F1B2E',
          muted: '#6B6580',
        }
      }
    },
  },
  plugins: [],
}
