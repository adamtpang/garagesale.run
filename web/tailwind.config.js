/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  // Preflight off: app/globals.css already ships its own reset; keeps un-converted pages intact.
  corePlugins: { preflight: false },
  theme: {
    container: { center: true, padding: '1.25rem', screens: { '2xl': '1240px' } },
    extend: {
      colors: {
        border: 'hsl(var(--border))', input: 'hsl(var(--input))', ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))', foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        brand: 'hsl(var(--brand))', success: 'hsl(var(--success))',
        // Dark sticker red for text links. Brand orange is too light for small text.
        link: '#a52a14', price: '#d6321a',
      },
      // Price Tag corners are tight everywhere, so the big radii collapse to the same small one.
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)', xl: 'var(--radius)', '2xl': 'var(--radius)', '3xl': 'var(--radius)', full: '6px' },
      borderWidth: { DEFAULT: '2px' },
      boxShadow: { tag: '4px 4px 0 hsl(var(--foreground))', 'tag-sm': '2px 2px 0 hsl(var(--foreground))' },
      fontFamily: { marker: ['var(--font-marker)', '"Comic Sans MS"', 'cursive'], sans: ['var(--font-dm)', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"SF Pro Text"', '"Segoe UI"', 'Helvetica', 'Arial', 'sans-serif'] },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
