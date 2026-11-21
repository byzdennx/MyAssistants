/**
 * Palet & font MyAssistant.
 * Warna semantik memakai CSS variable (lihat src/styles/globals.css) supaya
 * tema terang / sepia / gelap bisa ditukar tanpa menyentuh komponen.
 * Palet statis dari brief tetap tersedia sebagai `cream` dan `sepia`.
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)',
        'paper-2': 'var(--paper-2)',
        ink: 'var(--ink)',
        'ink-soft': 'var(--ink-soft)',
        'ink-faint': 'var(--ink-faint)',
        terracotta: 'var(--terracotta)',
        accent: 'var(--accent-ink)',
        sage: 'var(--sage)',
        'sage-ink': 'var(--sage-ink)',
        gold: 'var(--gold)',
        'gold-ink': 'var(--gold-ink)',
        rule: 'var(--rule)',
        'rule-strong': 'var(--rule-strong)',
        'bubble-user': 'var(--bubble-user)',
        'bubble-ink': 'var(--bubble-user-ink)',
        cream: { DEFAULT: '#F4EDE4', deep: '#EDE4D3' },
        sepia: { DEFAULT: '#2B2118', soft: '#3D2E22' },
      },
      fontFamily: {
        display: ['"Instrument Serif"', 'Fraunces', 'Georgia', 'serif'],
        serif: ['Fraunces', '"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', 'Geist', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        sm: '2px',
        md: '5px',
        lg: '8px',
        xl: '12px',
      },
    },
  },
};
