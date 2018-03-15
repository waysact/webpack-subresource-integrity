const SriPlugin = require('webpack-subresource-integrity');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  entry: {
    index: './index.js'
  },
  plugins: [
    new MiniCssExtractPlugin({
      // Options similar to the same options in webpackOptions.output
      // both options are optional
      filename: '[name].css',
      chunkFilename: '[id].css'
    }),
    new SriPlugin({
      hashFuncNames: ['sha256', 'sha384'],
      enabled: true
    }),
    new HtmlWebpackPlugin()
  ],
  output: {
    crossOriginLoading: 'anonymous'
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              namedExport: true,
              modules: true,
              camelCase: true,
              sourceMap: true,
              localIdentName: '[name]__[local]--[hash:2]',
              importLoaders: 1
            }
          }
        ]
      }
    ]
  }
};
