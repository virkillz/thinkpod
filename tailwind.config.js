/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        parchment: {
          base:    'var(--color-parchment-base)',
          sidebar: 'var(--color-parchment-sidebar)',
          dark:    'var(--color-parchment-dark)',
          card:    'var(--color-parchment-card)',
        },
        ink: {
          primary: 'var(--color-ink-primary)',
          muted:   'var(--color-ink-muted)',
          light:   'var(--color-ink-light)',
        },
        accent: {
          DEFAULT: 'rgb(var(--color-accent-rgb) / <alpha-value>)',
          hover:   'var(--color-accent-hover)',
          light:   'var(--color-accent-light)',
        },
        wilfred: {
          glow: '#F59E0B',
          idle: '#78716C',
        },
        success: '#22C55E',
        error:   '#EF4444',
        warning: '#F59E0B',
      },
      fontFamily: {
        sans:  ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Lora', 'Georgia', 'serif'],
      },
      animation: {
        'breathe':    'breathe 4s ease-in-out infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%':      { transform: 'scale(1.02)' },
        },
      },
    },
  },
  plugins: [],
}
