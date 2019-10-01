var expect = require('expect');
var fs = require('fs');
var path = require('path');

var webpackVersion = Number(require('webpack/package.json').version.split('.')[0]);

module.exports.skip = function skip() {
  return webpackVersion < 4;
};

module.exports.check = function check(stats) {
  expect(stats.compilation.warnings.length).toEqual(0);
};
