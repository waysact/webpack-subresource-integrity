var expect = require('expect');

module.exports.check = function check(stats) {
  expect(stats.compilation.assets['bundle.js'].integrity).toMatch(/^sha/);
};
