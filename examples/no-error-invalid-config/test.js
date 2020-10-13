var expect = require('expect');
var ChunkRenderError = require('webpack/lib/ChunkRenderError');
var webpackVersion = Number(
  require('webpack/package.json').version.split('.')[0]
);

module.exports.skip = function skip() {
  // Error doesn't get triggered with Webpack > 4.
  return webpackVersion > 4;
};

module.exports.ignoreErrors = true;

module.exports.check = function check(stats) {
  expect(stats.compilation.warnings).toEqual([]);
  expect(stats.compilation.errors.length).toEqual(1);
  expect(stats.compilation.errors[0]).toBeInstanceOf(ChunkRenderError);
};
