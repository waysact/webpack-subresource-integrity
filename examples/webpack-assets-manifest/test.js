var expect = require('expect');
var fs = require('fs');
var path = require('path');
var webpackVersion = Number(
  require('webpack/package.json').version.split('.')[0]
);

module.exports.skip = function skip() {
  // webpack-assets-manifest 3 requires Webpack 4
  return webpackVersion < 4;
};

module.exports.check = function check(stats) {
  var manifest = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'dist/manifest.json'), 'utf-8')
  );
  expect(manifest['index.js'].integrity).toMatch(/sha384-.* sha512-.*/);
};
