var SriPlugin = require('webpack-subresource-integrity');
var webpackVersion = Number(
  require('webpack/package.json').version.split('.')[0]
);

module.exports = {
  entry: './index.js',
  output: {
    crossOriginLoading: 'anonymous',
    filename: 'bundle.js'
  },
  plugins: [
    new SriPlugin({ hashFuncNames: ['sha256'], jsonFile: 'integrity.json' })
  ]
};