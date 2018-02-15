var expect = require('expect');

module.exports.check = function check(stats) {
  expect(stats.compilation.warnings).toEqual([]);
};
