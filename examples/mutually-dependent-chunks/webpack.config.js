var SriPlugin = require('webpack-subresource-integrity');

module.exports = {
  entry: './main.js',
  output: {
    filename: 'bundle.js',
    crossOriginLoading: 'anonymous'
  },
  plugins: [new SriPlugin({ hashFuncNames: ['sha256', 'sha384'] })]
};
