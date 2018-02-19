var expect = require('expect');

module.exports.check = function check(stats) {
  expect(stats.compilation.warnings.length).toEqual(0);
};
