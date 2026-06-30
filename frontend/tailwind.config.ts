import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef4ff',
          100: '#d9e6ff',
          200: '#bcd0ff',
          300: '#8eb2ff',
          400: '#5a8df5',
          500: '#3b7be8',
          600: '#2176D2',
          700: '#1a5fa8',
          800: '#1a4d8a',
          900: '#1a4270',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
