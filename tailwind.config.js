/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        'game-bg': '#1a0b2e',
        'game-bg-dark': '#0f061a',
        'game-card': '#2d2d44',
        'game-card-hover': '#3d3d5c',
        'game-gold': '#d4af37',
        'game-gold-light': '#f0d76a',
        'fire': '#ff4d4d',
        'fire-light': '#ff8080',
        'water': '#4da6ff',
        'water-light': '#80c1ff',
        'grass': '#4dff88',
        'grass-light': '#80ffaa',
        'thunder': '#ffcc00',
        'thunder-light': '#ffe066',
      },
      fontFamily: {
        'display': ['Cinzel', 'serif'],
        'body': ['"Noto Sans SC"', 'sans-serif'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'shake': 'shake 0.5s ease-in-out',
        'pop-in': 'pop-in 0.3s ease-out',
        'slide-up': 'slide-up 0.5s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px currentColor' },
          '50%': { boxShadow: '0 0 40px currentColor, 0 0 60px currentColor' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-5px)' },
          '75%': { transform: 'translateX(5px)' },
        },
        'pop-in': {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '50%': { transform: 'scale(1.2)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
