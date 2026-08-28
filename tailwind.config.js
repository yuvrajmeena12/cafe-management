/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        sage: {
          50: '#f2f5f1', 100: '#dfe7db', 200: '#cbd5c5', 300: '#a8bba1', 400: '#5c7a5a',
          500: '#476545', 600: '#3d5c3b', 700: '#2f4a2e', 800: '#233922', 900: '#1c2e1b', 950: '#111d10'
        },
        saffron: {
          50: '#fdf7f0', 100: '#fbeee0', 200: '#f7dcc1', 300: '#f3c49a',
          400: '#f0a860', 500: '#e8873d', 600: '#d8722a', 700: '#b8581d', 800: '#94441b'
        },
        cream: '#fdf6ec'
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        body: ['"Inter"', 'sans-serif']
      }
    },
  },
  plugins: [],
}
