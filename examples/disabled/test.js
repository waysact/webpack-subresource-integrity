var expect = require('expect');

module.exports.check = function check(stats) {
  expect(typeof stats.compilation.assets['bundle.js'].integrity).toBe(
    'undefined'
  );
  expect(stats.compilation.warnings).toEqual([]);
};
