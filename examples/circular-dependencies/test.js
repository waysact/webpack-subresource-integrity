var expect = require('expect');
var webpackVersion = Number(
  require('webpack/package.json').version.split('.')[0]
);

module.exports.skip = function skip() {
  // Can't find a way yet to replicate this test on Webpack 4
  return webpackVersion >= 4;
};

module.exports.check = function check(stats) {
  expect(stats.compilation.assets['chunk1.js'].integrity).toMatch(/^sha/);
  expect(stats.compilation.assets['chunk2.js'].integrity).toMatch(/^sha/);
};
