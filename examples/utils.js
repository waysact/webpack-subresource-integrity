var ExtractTextPlugin = require('extract-text-webpack-plugin');
var ExtractTextPluginVersion = require('extract-text-webpack-plugin/package.json')
  .version;

module.exports.createExtractTextLoader = function createExtractTextLoader() {
  if (ExtractTextPluginVersion.match(/^1\./)) {
    // extract-text-webpack-plugin 1.x
    return ExtractTextPlugin.extract('style-loader', 'css-loader');
  }
  // extract-text-webpack-plugin 2.x
  return ExtractTextPlugin.extract({
    fallback: 'style-loader',
    use: 'css-loader'
  });
};
