var expect = require('expect');

module.exports.check = function check(stats) {
  expect(stats.compilation.warnings.length).toEqual(1);
  expect(stats.compilation.warnings[0]).toBeInstanceOf(Error);
  expect(stats.compilation.warnings[0].message).toEqual(
    "webpack-subresource-integrity: Cannot determine hash for asset 'test.png', the resource will be unprotected."
  );
};
