/** @type {import('tailwindcss').Config} */

// Every colour is a CSS variable holding an "R G B" triplet (see src/theme/tokens.css),
// so light/dark/accent switching happens purely by changing attributes on <html>.
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

const pastel = (key) => ({
  DEFAULT: v(`${key}-soft`), // soft fill for chips / tiles
  soft: v(`${key}-soft`),
  strong: v(`${key}-strong`), // saturated pastel for bars, dots, chart series
  ink: v(`${key}-ink`), // AA-contrast text on top of the soft fill
});

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        'surface-2': v('surface-2'),
        line: v('line'),
        ink: v('ink'),
        muted: v('muted'),
        faint: v('faint'),
        accent: {
          DEFAULT: v('accent'), // primary button fill
          soft: v('accent-soft'),
          ink: v('accent-ink'),
          on: v('on-accent'), // text on top of the accent fill
        },
        mint: pastel('mint'),
        sky: pastel('sky'),
        peach: pastel('peach'),
        lavender: pastel('lavender'),
        butter: pastel('butter'),
        coral: pastel('coral'),
        grey: pastel('grey'),
      },
      borderRadius: {
        card: '16px',
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        lift: 'var(--shadow-lift)',
      },
      ringColor: {
        DEFAULT: v('accent'),
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
};
