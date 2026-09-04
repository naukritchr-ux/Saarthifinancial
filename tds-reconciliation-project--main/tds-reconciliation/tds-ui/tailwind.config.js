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
          header: '#3E4A5C',
          primary: '#6E8CA0',
          primaryHover: '#5B788C',
          secondary: '#8FA3BF',
          success: '#7FA88A',
          warning: '#C9A778',
          error: '#C08585',
          card: '#F6F8FA',
          page: '#EEF1F4',
          border: '#DCE2E8',
          text: '#3A4048',
          muted: '#7A8794',
        }
      }
    },
  },
  plugins: [],
}
