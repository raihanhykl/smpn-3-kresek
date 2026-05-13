import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '24px',
      screens: { '2xl': '1240px' },
    },
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1565C0',
          light: '#1E88E5',
          dark: '#0D47A1',
          bg: '#E3F2FD',
        },
        secondary: {
          DEFAULT: '#F59E0B',
          light: '#FDE68A',
          bg: '#FFFBEB',
        },
        accent: {
          DEFAULT: '#16A34A',
          bg: '#DCFCE7',
        },
        neutral: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        },
      },
      fontFamily: {
        heading: ['var(--font-jakarta)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '6px',
        md: '12px',
        lg: '20px',
        xl: '28px',
      },
      boxShadow: {
        sm: '0 1px 3px rgba(0,0,0,0.08)',
        md: '0 4px 16px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
        lg: '0 12px 40px rgba(0,0,0,0.10), 0 4px 12px rgba(0,0,0,0.06)',
      },
      transitionTimingFunction: {
        brand: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(32px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scrollDot: {
          '0%': { opacity: '1', transform: 'translateX(-50%) translateY(0)' },
          '100%': { opacity: '0', transform: 'translateX(-50%) translateY(16px)' },
        },
        floatY: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'fade-up': 'fadeUp 700ms cubic-bezier(0.4,0,0.2,1) both',
        'fade-in': 'fadeIn 600ms cubic-bezier(0.4,0,0.2,1) both',
        'scroll-dot': 'scrollDot 1.6s cubic-bezier(0.4,0,0.2,1) infinite',
        'float-y': 'floatY 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
