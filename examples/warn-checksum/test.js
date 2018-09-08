var expect = require('expect');
var HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports.skip = function skip() {
  // Not sure how to provoke this warning with HWP 4
  // Consider removing this test altogether.
  return HtmlWebpackPlugin.version >= 4;
};

module.exports.check = function check(stats) {
  expect(stats.compilation.warnings.length).toEqual(1);
  expect(stats.compilation.warnings[0]).toBeInstanceOf(Error);
  expect(stats.compilation.warnings[0].message).toEqual(
    "webpack-subresource-integrity: Cannot determine hash for asset 'test.png', the resource will be unprotected."
  );
};
