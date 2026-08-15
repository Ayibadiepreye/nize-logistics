import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1E5BBA',
          50: '#E8F0FC',
          100: '#D1E1F9',
          200: '#A3C3F3',
          300: '#75A5ED',
          400: '#4787E7',
          500: '#1E5BBA',
          600: '#18498F',
          700: '#123764',
          800: '#0C2539',
          900: '#06120E',
        },
        accent: {
          DEFAULT: '#E91E5C',
          50: '#FCE8EF',
          100: '#F9D1DF',
          200: '#F3A3BF',
          300: '#ED759F',
          400: '#E7477F',
          500: '#E91E5C',
          600: '#BA184A',
          700: '#8C1237',
          800: '#5D0C25',
          900: '#2F0612',
        },
        teal: {
          DEFAULT: '#2A9D9F',
          50: '#E8F7F7',
          100: '#D1EFEF',
          200: '#A3DFDF',
          300: '#75CFCF',
          400: '#47BFBF',
          500: '#2A9D9F',
          600: '#227E7F',
          700: '#195E5F',
          800: '#113F40',
          900: '#081F20',
        },
        dark: {
          DEFAULT: '#0D1B3D',
          50: '#E6E8ED',
          100: '#CDD1DB',
          200: '#9BA3B7',
          300: '#697593',
          400: '#37476F',
          500: '#0D1B3D',
          600: '#0A1631',
          700: '#081025',
          800: '#050B18',
          900: '#03050C',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  /**
   * Design-system variants are composed at runtime (`badge-${tone}`,
   * `btn-${variant}`, `toast-${tone}`), so their literal class names never
   * appear in the source. Tailwind tree-shakes @layer components by content
   * scanning, which silently dropped every rule it could not see — status
   * badges rendered with no colour at all. Safelisting keeps the families.
   */
  safelist: [
    { pattern: /^badge-(neutral|brand|info|success|warning|danger|accent)$/ },
    { pattern: /^btn-(primary|secondary|outline|outline-light|ghost|accent|success|danger|sm|lg|block)$/ },
    { pattern: /^toast-(success|error|warning)$/ },
    { pattern: /^service-icon-(red|green)$/ },
  ],
  plugins: [],
};

export default config;
