var SriPlugin = require('webpack-subresource-integrity');
var MiniCssExtractPlugin = require('mini-css-extract-plugin');
var WebpackAssetsManifest = require('webpack-assets-manifest');
var FixStyleOnlyEntriesPlugin = require('webpack-fix-style-only-entries');

module.exports = {
  entry: {
    index: './index.js',
    style: ["./style.css"],
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
              importLoaders: 1
            }
          }
        ]
      },
    ],
  },
  output: {
    crossOriginLoading: 'anonymous'
  },
  plugins: [
    new FixStyleOnlyEntriesPlugin({
      silent: true
    }),
    new MiniCssExtractPlugin({
      filename: "[name].css",
    }),
    new WebpackAssetsManifest({integrity: true}),
    new SriPlugin({
      hashFuncNames: ['sha256', 'sha384'],
      enabled: true
    }),
  ]
};
