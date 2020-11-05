var expect = require('expect');
var webpackVersion = Number(
  require('webpack/package.json').version.split('.')[0]
);

module.exports.skip = function skip() {
  return webpackVersion < 5;
};

module.exports.check = function check(stats) {
  expect(stats.compilation.errors).toEqual([]);
  expect(stats.compilation.warnings).toEqual([]);
};
