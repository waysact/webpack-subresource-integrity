var expect = require('expect');

module.exports.check = function check(stats) {
  expect(stats.compilation.warnings.length).toEqual(1);
  expect(stats.compilation.warnings[0]).toBeAn(Error);
  expect(stats.compilation.warnings[0].message).toMatch(
    /may interfere with hot reloading./
  );
};
