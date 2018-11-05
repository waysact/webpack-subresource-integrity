var SriPlugin = require('webpack-subresource-integrity');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var WebpackBeforeBuildPlugin = require('before-build-webpack');
var webpack = require('webpack');
var path = require('path');
var AddAssetHtmlPlugin = require('add-asset-html-webpack-plugin');

module.exports = {
  // mode: "development || "production",
  resolve: {
    extensions: ['.js', '.jsx']
  },
  entry: {
    alpha: ['./alpha', './a'],
    beta: ['./beta', './b', './c']
  },
  output: {
    filename: 'MyDll.[name].js',
    library: '[name]_[hash]'
  },
  plugins: [
    new webpack.DllPlugin({
      path: path.join(__dirname, 'dist', '[name]-manifest.json'),
      name: '[name]_[hash]'
    }),
    new WebpackBeforeBuildPlugin(
      function(_stats, callback) {
        webpack(
          {
            mode: 'production',
            entry: {
              index: './index.js'
            },
            output: {
              path: path.join(__dirname, 'dist'),
              crossOriginLoading: 'anonymous'
            },
            plugins: [
              new webpack.DllReferencePlugin({
                context: path.join(__dirname),
                manifest: require(path.join(
                  __dirname,
                  'dist/alpha-manifest.json'
                )) // eslint-disable-line
              }),
              new webpack.DllReferencePlugin({
                scope: 'beta',
                manifest: require(path.join(
                  __dirname,
                  'dist/beta-manifest.json'
                )), // eslint-disable-line
                extensions: ['.js', '.jsx']
              }),
              new HtmlWebpackPlugin(),
              new AddAssetHtmlPlugin({
                filepath: path.resolve(__dirname, 'dist/MyDll.*.js')
              }),
              new SriPlugin({
                hashFuncNames: ['sha256', 'sha384'],
                enabled: true
              })
            ]
          },
          function afterEmit(err, stats) {
            if (err || stats.hasErrors() || stats.hasWarnings()) {
              throw err || new Error(stats.toString({ reason: true }));
            } else {
              callback();
            }
          }
        );
      },
      ['done']
    )
  ]
};
