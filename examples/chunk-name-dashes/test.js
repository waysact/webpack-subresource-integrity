var expect = require('expect');
var fs = require('fs');
var vm = require('vm');
var webpack = require('webpack');

module.exports.skip = function skip() {
  return !webpack.NamedChunksPlugin;
};

module.exports.check = function check(stats) {
  expect(stats.compilation.warnings).toEqual([]);

  // Ensure generated code can be parsed
  // eslint-disable-next-line no-new
  new vm.Script(fs.readFileSync('dist/bundle.js'));
};
