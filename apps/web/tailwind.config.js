/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx,css}'],
  theme: {
    extend: {
      colors: {
        // Literal values so @apply and JIT generate classes (no var() in theme for utilities).
        // Mirrors the "Grey Glass" tokens in src/styles/theme.css.
        app: {
          bg: '#EBEDF1',
          surface: '#D4D8DF',
          'surface-1': '#D4D8DF',
          'surface-2': '#EBEDF1',
          border: 'rgba(172,173,177,0.40)',
          'border-focus': 'rgba(8,8,8,0.55)',
          primary: '#080808',
          secondary: '#706F70',
          muted: '#ACADB1',
          accent: '#080808',
          'accent-hover': '#353536',
          'accent-muted': 'rgba(8,8,8,0.06)',
          danger: '#B42318',
          'danger-muted': 'rgba(180,35,24,0.10)',
          success: '#067647',
          'success-muted': 'rgba(6,118,71,0.10)',
          warning: '#B54708',
          'warning-muted': 'rgba(181,71,8,0.10)',
          overlay: 'rgba(53,53,54,0.35)',
        },
        danger: '#B42318',
        success: '#067647',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 8px 32px rgba(8,8,8,0.08)',
        modal: '0 24px 60px -12px rgba(8,8,8,0.28)',
        button: '0 1px 2px rgba(8,8,8,0.10)',
      },
    },
  },
  plugins: [],
};
