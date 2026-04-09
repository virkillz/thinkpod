/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        parchment: {
          base: '#F5F0E8',
          sidebar: '#EDE8DC',
          dark: '#E5DDD0',
        },
        ink: {
          primary: '#1C1917',
          muted: '#78716C',
          light: '#A8A29E',
        },
        accent: {
          DEFAULT: '#8B6914',
          hover: '#6B5110',
          light: '#D4B896',
        },
        wilfred: {
          glow: '#F59E0B',
          idle: '#78716C',
        },
        success: '#22C55E',
        error: '#EF4444',
        warning: '#F59E0B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Lora', 'Georgia', 'serif'],
      },
      animation: {
        'breathe': 'breathe 4s ease-in-out infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.02)' },
        },
      },
    },
  },
  plugins: [],
}