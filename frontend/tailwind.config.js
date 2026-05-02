/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        'claw-dark': '#040406',
        'claw-card': 'rgba(10, 10, 15, 0.6)',
        'claw-cyan': '#00f0ff',
        'claw-emerald': '#00ffaa',
        'claw-purple': '#b026ff',
        'claw-red': '#ff2a2a',
      },
      backgroundImage: {
        'grid-pattern': "url('data:image/svg+xml,%3Csvg width=\"40\" height=\"40\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cpath d=\"M0 0h40v40H0z\" fill=\"none\"/%3E%3Cpath d=\"M0 39.5h40\" stroke=\"rgba(255,255,255,0.03)\" stroke-width=\"1\"/%3E%3Cpath d=\"M39.5 0v40\" stroke=\"rgba(255,255,255,0.03)\" stroke-width=\"1\"/%3E%3C/svg%3E')",
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'beam': 'beam 2s linear infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '1', filter: 'drop-shadow(0 0 15px rgba(0,240,255,0.8))' },
          '50%': { opacity: '0.6', filter: 'drop-shadow(0 0 5px rgba(0,240,255,0.3))' },
        },
        beam: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        }
      }
    },
  },
  plugins: [],
}
