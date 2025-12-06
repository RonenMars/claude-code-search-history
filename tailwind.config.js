/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx,html}'],
  theme: {
    extend: {
      colors: {
        claude: {
          orange: '#D97706',
          dark: '#1a1a1a',
          darker: '#0d0d0d'
        }
      }
    }
  },
  plugins: []
}
