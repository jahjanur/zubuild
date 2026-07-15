/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx,css}'],
  theme: {
    extend: {
      colors: {
        // All colours are CSS vars so the app re-skins per theme (see theme.css).
        app: {
          bg: 'var(--app-bg)',
          'surface-1': 'var(--surface-1)',
          'surface-2': 'var(--surface-2)',
          'surface-subtle': 'var(--surface-subtle)',
          border: 'var(--border)',
          'border-strong': 'var(--border-strong)',
          'border-focus': 'var(--border-focus)',
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          accent: 'rgb(var(--accent-rgb) / <alpha-value>)',
          'accent-hover': 'var(--accent-hover)',
          'accent-contrast': 'var(--accent-contrast)',
          'accent-muted': 'var(--accent-muted)',
          'accent-light': 'var(--accent-light)',
          'accent-warm': 'var(--accent-warm)',
          danger: 'rgb(var(--danger-rgb) / <alpha-value>)',
          'danger-muted': 'var(--danger-muted)',
          success: 'rgb(var(--success-rgb) / <alpha-value>)',
          'success-muted': 'var(--success-muted)',
          warning: 'rgb(var(--warning-rgb) / <alpha-value>)',
          'warning-muted': 'var(--warning-muted)',
          overlay: 'var(--overlay)',
        },
        sidebar: {
          bg: 'var(--sidebar-bg)',
          border: 'var(--sidebar-border)',
          text: 'var(--sidebar-text)',
          active: 'var(--sidebar-text-active)',
          hover: 'var(--sidebar-hover)',
          'active-bg': 'var(--sidebar-active-bg)',
          section: 'var(--sidebar-section)',
        },
        danger: 'rgb(var(--danger-rgb) / <alpha-value>)',
        success: 'rgb(var(--success-rgb) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', '"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        modal: 'var(--shadow-modal)',
        button: 'var(--shadow-button)',
      },
      transitionDuration: {
        150: '150ms',
      },
    },
  },
  plugins: [],
};
