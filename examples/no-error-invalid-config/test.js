var expect = require('expect');
var ChunkRenderError = require('webpack/lib/ChunkRenderError');

module.exports.ignoreErrors = true;

module.exports.check = function check(stats) {
  expect(stats.compilation.warnings).toEqual([]);
  expect(stats.compilation.errors.length).toEqual(1);
  expect(stats.compilation.errors[0]).toBeInstanceOf(ChunkRenderError);
};
