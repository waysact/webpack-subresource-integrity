const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const SriPlugin = require('webpack-subresource-integrity');

module.exports = {
  mode: 'production',
  entry: './index.js',
  output: {
    crossOriginLoading: 'anonymous',
    chunkFilename: '[name]-[chunkhash].js',
    filename: '[name]-[contenthash].js'
  },
  optimization: {
    splitChunks: {
      cacheGroups: {
        styles: {
          name: 'style',
          chunks: 'all',
          enforce: true
        }
      }
    }
  },
  plugins: [
    new MiniCssExtractPlugin({ filename: '[name].css' }),
    new SriPlugin({
      hashFuncNames: ['sha256', 'sha384']
    })
  ],
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader']
      }
    ]
  }
};
