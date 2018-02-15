var SriPlugin = require('webpack-subresource-integrity');
var HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './index.js',
  output: {
    filename: 'subdir/bundle.js',
    crossOriginLoading: 'anonymous'
  },
  plugins: [
    new HtmlWebpackPlugin({
      hash: true,
      filename: 'assets/admin.html'
    }),
    new SriPlugin({ hashFuncNames: ['sha256', 'sha384'] })
  ]
};
