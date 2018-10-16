var expect = require('expect');
var webpackVersion = Number(
  require('webpack/package.json').version.split('.')[0]
);
var nodeVersion = Number(process.versions.node.split('.')[0]);

module.exports.skip = function skip() {
  // Can't use add-asset-html-webpack-plugin with older Webpack or
  // Node versions.
  return webpackVersion < 4 || nodeVersion < 8;
};

module.exports.check = function check(stats) {
  expect(stats.compilation.errors).toEqual([]);
  expect(stats.compilation.warnings).toEqual([]);
};
