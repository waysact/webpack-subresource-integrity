var webpackVersionComponents = require('webpack/package.json').version.split(
  '.'
);
var webpackVersionMajor = Number(webpackVersionComponents[0]);
var webpackVersionMinor = Number(webpackVersionComponents[0]);
var expect = require('expect');

module.exports.skip = function skip() {
  return (
    webpackVersionMajor < 4 ||
    (webpackVersionMajor === 4 && webpackVersionMinor < 3)
  );
};

module.exports.check = function check(stats) {
  expect(stats.compilation.warnings).toEqual([]);
};
