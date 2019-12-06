var expect = require('expect');
var webpackVersion = Number(
  require('webpack/package.json').version.split('.')[0]
);

module.exports.skip = function skip() {
  // Can't use extract-text-webpack-plugin with Webpack > 4.
  return webpackVersion > 4;
};

module.exports.check = function check(stats) {
  expect(stats.compilation.warnings).toEqual([]);
};
