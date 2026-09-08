import resolve from '@rollup/plugin-node-resolve';

export default {
  input: 'src/simple-timer-card.js',
  output: {
    file: 'simple-timer-card.js',
    format: 'es',
  },
  plugins: [
    resolve(),
  ]
};