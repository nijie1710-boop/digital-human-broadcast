/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      boxShadow: {
        panel: '0 18px 50px rgba(25, 42, 90, 0.08)',
        soft: '0 12px 30px rgba(39, 56, 117, 0.08)',
      },
      colors: {
        ink: '#10182F',
      },
    },
  },
  plugins: [],
};
