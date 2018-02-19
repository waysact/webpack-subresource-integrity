var SriPlugin = require('webpack-subresource-integrity');
var HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './index.js',
  output: {
    filename: 'bundle.js',
    publicPath: '/',
    crossOriginLoading: 'anonymous'
  },
  plugins: [
    new HtmlWebpackPlugin(),
    new SriPlugin({ hashFuncNames: ['sha256', 'sha384'] })
  ]
};
