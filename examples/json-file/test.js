var expect = require('expect');

module.exports.check = function check(stats) {
  var json = stats.compilation.assets['integrity.json']
  expect(typeof json).toBe('object');

  json = JSON.parse(json.source());
  expect(typeof json).toBe('object');
  expect(json['bundle.js']).toBe(stats.compilation.assets['bundle.js'].integrity);
};
