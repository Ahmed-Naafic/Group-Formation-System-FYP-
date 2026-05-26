/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1200px' },
    },
    extend: {
      // ── JUST brand color ramps ─────────────────────────────────────────────
      colors: {
        'just-blue': {
          50:  'var(--just-blue-50)',
          100: 'var(--just-blue-100)',
          200: 'var(--just-blue-200)',
          300: 'var(--just-blue-300)',
          400: 'var(--just-blue-400)',
          500: 'var(--just-blue-500)',
          600: 'var(--just-blue-600)',
          700: 'var(--just-blue-700)',
          800: 'var(--just-blue-800)',
          900: 'var(--just-blue-900)',
        },
        'just-green': {
          50:  'var(--just-green-50)',
          100: 'var(--just-green-100)',
          200: 'var(--just-green-200)',
          300: 'var(--just-green-300)',
          400: 'var(--just-green-400)',
          500: 'var(--just-green-500)',
          600: 'var(--just-green-600)',
          700: 'var(--just-green-700)',
          800: 'var(--just-green-800)',
          900: 'var(--just-green-900)',
        },
        'just-gold': {
          50:  'var(--just-gold-50)',
          100: 'var(--just-gold-100)',
          200: 'var(--just-gold-200)',
          300: 'var(--just-gold-300)',
          400: 'var(--just-gold-400)',
          500: 'var(--just-gold-500)',
          600: 'var(--just-gold-600)',
          700: 'var(--just-gold-700)',
        },
        paper:     'var(--paper)',
        'paper-2': 'var(--paper-2)',
        ink: {
          50:  'var(--ink-50)',
          100: 'var(--ink-100)',
          200: 'var(--ink-200)',
          300: 'var(--ink-300)',
          400: 'var(--ink-400)',
          500: 'var(--ink-500)',
          600: 'var(--ink-600)',
          700: 'var(--ink-700)',
          800: 'var(--ink-800)',
          900: 'var(--ink-900)',
        },
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger:  'var(--danger)',
        info:    'var(--info)',
        // shadcn/ui semantic layer — mapped to JUST tokens in index.css
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT:    'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT:    'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT:    'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT:    'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT:    'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT:    'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT:    'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        border: 'var(--border)',
        input:  'var(--input)',
        ring:   'var(--ring)',
      },

      fontFamily: {
        serif:  ['var(--font-serif)'],
        sans:   ['var(--font-sans)'],
        arabic: ['var(--font-arabic)'],
        mono:   ['var(--font-mono)'],
      },

      borderRadius: {
        none:    '0',
        xs:      '2px',
        sm:      '4px',
        DEFAULT: '8px',
        md:      '8px',
        lg:      '12px',
        xl:      '16px',
        '2xl':   '24px',
        full:    '9999px',
      },

      boxShadow: {
        xs:      'var(--shadow-xs)',
        sm:      'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-sm)',
        md:      'var(--shadow-md)',
        lg:      'var(--shadow-lg)',
        xl:      'var(--shadow-xl)',
        brand:   'var(--shadow-brand)',
        focus:   'var(--shadow-focus)',
      },

      transitionDuration: {
        fast: '120ms',
        base: '200ms',
        slow: '320ms',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
