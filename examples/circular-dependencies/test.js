var expect = require('expect');

module.exports.check = function check(stats) {
  expect(stats.compilation.assets['chunk1.js'].integrity).toMatch(/^sha/);
  expect(stats.compilation.assets['chunk2.js'].integrity).toMatch(/^sha/);
};
