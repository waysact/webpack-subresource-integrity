var SriPlugin = require('webpack-subresource-integrity');

module.exports = {
  entry: './index.js',
  output: {
    filename: 'bundle.js'
  },
  plugins: [new SriPlugin({ hashFuncNames: ['sha256'], enabled: false })]
};
