/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        spotlight: {
          bg: '#121217',
          surface: '#181820',
          hover: '#22222d',
          border: 'rgba(255, 255, 255, 0.08)',
          accent: '#6366f1',
          accentLight: '#818cf8',
          text: '#f3f4f6',
          muted: '#9ca3af',
          dim: '#6b7280',
        },
      },
      boxShadow: {
        'spotlight': '0 25px 60px -15px rgba(0, 0, 0, 0.85), 0 0 1px 1px rgba(255, 255, 255, 0.08)',
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      },
    },
  },
  plugins: [],
}
