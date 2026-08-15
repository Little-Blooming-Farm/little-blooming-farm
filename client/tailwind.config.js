/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Warm paper base — the site's "white". Never pure #fff.
        bloom: {
          50: '#FDFBF7',
          100: '#F8F3E9',
          200: '#F0E7D6',
          300: '#E4D6BE',
          400: '#D3BE9C',
        },
        // Muted greens — the land.
        moss: {
          50: '#F2F4EF',
          100: '#DFE5D8',
          200: '#BFCCB4',
          300: '#9AAE8C',
          400: '#778D68',
          500: '#5C7150',
          600: '#485A3F',
          700: '#374733',
          800: '#2A3628',
          900: '#1F281E',
        },
        // Earth / terracotta accents.
        clay: {
          100: '#EFE2D6',
          200: '#DCC7B2',
          300: '#C4A88C',
          400: '#A98668',
          500: '#8B6A4F',
          600: '#6E523C',
        },
        // Soft gold — used sparingly, for rules and small marks.
        gold: {
          200: '#EBD9A9',
          300: '#DEC27E',
          400: '#CBA857',
          500: '#B08D3E',
          600: '#8C6E2E',
        },
        ink: {
          DEFAULT: '#24231F',
          soft: '#4A473F',
          muted: '#7A756A',
          faint: '#A9A296',
        },
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'Times New Roman', 'serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        // Editorial display scale — generous, with tight leading on large sizes.
        'display-sm': ['2.5rem', { lineHeight: '1.1', letterSpacing: '-0.01em' }],
        'display-md': ['3.5rem', { lineHeight: '1.05', letterSpacing: '-0.015em' }],
        'display-lg': ['4.75rem', { lineHeight: '1.02', letterSpacing: '-0.02em' }],
        'display-xl': ['6.5rem', { lineHeight: '0.98', letterSpacing: '-0.025em' }],
      },
      letterSpacing: {
        eyebrow: '0.24em',
        label: '0.08em',
      },
      maxWidth: {
        prose: '68ch',
        editorial: '90rem',
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
        30: '7.5rem',
        38: '9.5rem',
      },
      transitionTimingFunction: {
        // The house easing curve. Slow out, long settle. Nothing snappy.
        gentle: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      transitionDuration: {
        700: '700ms',
        1000: '1000ms',
        1400: '1400ms',
      },
      boxShadow: {
        soft: '0 2px 40px -12px rgba(36, 35, 31, 0.14)',
        lift: '0 18px 60px -24px rgba(36, 35, 31, 0.35)',
      },
      keyframes: {
        'slow-zoom': {
          '0%': { transform: 'scale(1)' },
          '100%': { transform: 'scale(1.08)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'slow-zoom': 'slow-zoom 24s ease-out forwards',
        'fade-in': 'fade-in 1.2s cubic-bezier(0.22, 1, 0.36, 1) forwards',
      },
    },
  },
  plugins: [],
};
