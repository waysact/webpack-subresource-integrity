var expect = require('expect');
var fs = require('fs');
var path = require('path');

module.exports.check = function check(stats) {
  expect(stats.compilation.warnings).toEqual([]);

  ['commons1.js', 'commons2.js'].forEach(function eachFile(filename) {
    expect(
      fs
        .readFileSync(path.join('dist', filename), 'utf-8')
        .indexOf('CHUNK-SRI-HASH')
    ).toEqual(-1);
  });
};
