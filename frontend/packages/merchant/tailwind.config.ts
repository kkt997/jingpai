import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#1677FF', dark: '#0958D9' },
      },
    },
  },
  plugins: [],
};

export default config;
