/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx,css}'],
  theme: {
    extend: {
      colors: {
        // "Clarity" palette — near-white canvas, white cards, indigo accent.
        app: {
          bg: '#F7F8FA',
          'surface-1': '#FFFFFF',
          'surface-2': '#FFFFFF',
          'surface-subtle': '#F3F4F6',
          border: '#E5E7EB',
          'border-strong': '#D1D5DB',
          'border-focus': '#4F46E5',
          primary: '#111827',
          secondary: '#4B5563',
          muted: '#6B7280',
          accent: '#4F46E5',
          'accent-hover': '#4338CA',
          'accent-muted': 'rgba(79,70,229,0.08)',
          danger: '#DC2626',
          'danger-muted': 'rgba(220,38,38,0.10)',
          success: '#059669',
          'success-muted': 'rgba(5,150,105,0.10)',
          warning: '#D97706',
          'warning-muted': 'rgba(217,119,6,0.10)',
          overlay: 'rgba(17,24,39,0.45)',
        },
        // Dark sidebar
        sidebar: {
          bg: '#0F1117',
          border: 'rgba(255,255,255,0.08)',
          text: '#9CA3AF',
          active: '#FFFFFF',
          hover: 'rgba(255,255,255,0.06)',
          'active-bg': 'rgba(79,70,229,0.16)',
          section: '#6B7280',
        },
        danger: '#DC2626',
        success: '#059669',
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
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
