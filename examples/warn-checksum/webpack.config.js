var SriPlugin = require('webpack-subresource-integrity');
var HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './a.js',
  output: {
    crossOriginLoading: 'anonymous'
  },
  plugins: [
    new HtmlWebpackPlugin({ favicon: './test.png' }),
    new SriPlugin({ hashFuncNames: ['sha256', 'sha384'] })
  ]
};
