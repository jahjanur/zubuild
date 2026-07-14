/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx,css}'],
  theme: {
    extend: {
      colors: {
        // "Cosmic" palette — deep navy canvas, glass cards, rose-gold accent.
        app: {
          bg: '#1a1a22',
          'surface-1': 'rgba(255,255,255,0.06)',
          'surface-2': 'rgba(255,255,255,0.035)',
          'surface-subtle': 'rgba(255,255,255,0.05)',
          border: 'rgba(255,255,255,0.12)',
          'border-strong': 'rgba(255,255,255,0.22)',
          'border-focus': '#C4836E',
          primary: '#ffffff',
          secondary: 'rgba(255,255,255,0.65)',
          muted: 'rgba(255,255,255,0.40)',
          accent: '#C4836E',
          'accent-hover': '#D3947F',
          'accent-contrast': '#1a1a22',
          'accent-muted': 'rgba(196,131,110,0.14)',
          'accent-light': '#E8B4A2',
          'accent-warm': '#8B5A4A',
          danger: '#F87171',
          'danger-muted': 'rgba(248,113,113,0.15)',
          success: '#34D399',
          'success-muted': 'rgba(52,211,153,0.15)',
          warning: '#FBBF24',
          'warning-muted': 'rgba(251,191,36,0.15)',
          overlay: 'rgba(9,9,14,0.6)',
        },
        // Dark sidebar
        sidebar: {
          bg: '#16161c',
          border: 'rgba(255,255,255,0.08)',
          text: 'rgba(255,255,255,0.55)',
          active: '#FFFFFF',
          hover: 'rgba(255,255,255,0.06)',
          'active-bg': 'rgba(196,131,110,0.16)',
          section: 'rgba(255,255,255,0.38)',
        },
        danger: '#F87171',
        success: '#34D399',
        // Brand crest gold (on the dark sidebar)
        brand: {
          gold: '#E4CE9C',
          'gold-soft': '#CBAE72',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', '"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
        brand: ['Cinzel', 'Georgia', 'serif'],
      },
      borderRadius: {
        card: '12px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.05)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08)',
        modal: '0 20px 40px -12px rgba(0,0,0,0.20)',
        button: '0 1px 2px rgba(0,0,0,0.05)',
      },
      transitionDuration: {
        150: '150ms',
      },
    },
  },
  plugins: [],
};
