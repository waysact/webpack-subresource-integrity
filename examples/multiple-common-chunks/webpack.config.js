var SriPlugin = require('webpack-subresource-integrity');
var webpack = require('webpack');
var webpackVersion = Number(
  require('webpack/package.json').version.split('.')[0]
);

module.exports = Object.assign(
  {
    entry: {
      pageA: './pageA.js',
      pageB: './pageB.js'
    },
    output: {
      filename: '[name].js',
      crossOriginLoading: 'anonymous'
    },
    plugins: (webpackVersion < 4
      ? [
          new webpack.optimize.CommonsChunkPlugin({
            name: 'commons1',
            chunks: ['pageA']
          }),
          new webpack.optimize.CommonsChunkPlugin({
            name: 'commons2',
            chunks: ['pageB']
          })
        ]
      : []
    ).concat([new SriPlugin({ hashFuncNames: ['sha256', 'sha384'] })])
  },
  webpackVersion < 4
    ? {}
    : {
        optimization: {
          splitChunks: {
            cacheGroups: {
              commons1: {
                test: /pageA/,
                chunks: 'initial',
                name: 'commons1',
                enforce: true
              },
              commons2: {
                test: /pageB/,
                chunks: 'initial',
                name: 'commons2',
                enforce: true
              }
            }
          }
        }
      }
);
