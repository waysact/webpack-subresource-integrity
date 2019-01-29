var SriPlugin = require('webpack-subresource-integrity');
var HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: {
    mainAppChunk: ['./index.js']
  },
  output: {
    filename: '[name].js',
    publicPath: '/',
    crossOriginLoading: 'anonymous'
  },
  optimization: {
    runtimeChunk: 'single',
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendors: {
          test: /node_modules/,
          name: 'vendors',
          chunks: 'all'
        }
      }
    }
  },
  plugins: [
    new HtmlWebpackPlugin(),
    new SriPlugin({ hashFuncNames: ['sha256', 'sha384'] })
  ]
};
