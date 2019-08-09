var expect = require('expect');
var fs = require('fs');
var path = require('path');

var webpackVersion = Number(require('webpack/package.json').version.split('.')[0]);

module.exports.skip = function skip() {
  return webpackVersion < 2;
};

module.exports.check = function check() {
  var findAndStripSriHashString = function(filePath, pattern, offset) {
    var fileContent = fs.readFileSync(path.join(__dirname, filePath), 'utf-8');
    var string = fileContent.substring(fileContent.indexOf(pattern) + (offset || 0))
        .match(/\{(.*?)\}/)[0].replace(/\\/g, '').replace(/\"/g, '');
    return string;
  }

  var sriHashesInSource = findAndStripSriHashString('dist/index.js', 'sha256-', -10);
  var sriHashesInMap = findAndStripSriHashString('dist/index.js.map', 'var sriHashes = ');
  expect(sriHashesInSource.length).toEqual(sriHashesInMap.length);
};
