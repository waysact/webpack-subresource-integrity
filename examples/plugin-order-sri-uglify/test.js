var fs = require('fs');
var crypto = require('crypto');
var expect = require('expect');
var webpackVersion = Number(
  require('webpack/package.json').version.split('.')[0]
);

module.exports.skip = function skip() {
  // Doesn't work on Webpack 4
  // Consider removing this test altogether.
  return webpackVersion >= 4;
};

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
