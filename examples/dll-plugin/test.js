var expect = require('expect');
var webpackVersion = Number(
  require('webpack/package.json').version.split('.')[0]
);

module.exports.skip = function skip() {
  // Can't use add-asset-html-webpack-plugin with older Webpack versions
  return webpackVersion < 4;
};

module.exports.check = function check(stats) {
  expect(stats.compilation.errors).toEqual([]);
  expect(stats.compilation.warnings).toEqual([]);
};
