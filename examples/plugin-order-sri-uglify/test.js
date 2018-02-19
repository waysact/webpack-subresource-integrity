var fs = require('fs');
var crypto = require('crypto');
var expect = require('expect');

module.exports.check = function check(stats) {
  var algo =
    stats.compilation.compiler.options.plugins[0].options.hashFuncNames[0];
  var source = fs.readFileSync('dist/bundle.js', 'utf8');
  var hash = crypto
    .createHash(algo)
    .update(source, 'utf8')
    .digest('base64');
  expect(stats.compilation.assets['bundle.js'].integrity).toEqual(
    algo + '-' + hash
  );
};
