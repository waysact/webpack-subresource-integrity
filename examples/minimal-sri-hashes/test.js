var expect = require('expect');
var fs = require('fs');
var path = require('path');
var webpackVersion = Number(
  require('webpack/package.json').version.split('.')[0]
);

module.exports.skip = function skip() {
  // this test case requires Webpack 4
  return webpackVersion < 4;
};

module.exports.check = function check() {
  var runtimeJs = fs.readFileSync(
    path.join(__dirname, 'dist/runtime.js'),
    'utf-8'
  );
  expect(runtimeJs).not.toMatch(/mainAppChunk/);
};
