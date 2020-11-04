var webpackVersionComponents = require('webpack/package.json').version.split(
  '.'
);
var webpackVersionMajor = Number(webpackVersionComponents[0]);

var defaultCheck = require("../../test/defaultCheck");
var fs = require('fs');

module.exports.skip = function skip() {
  return webpackVersionMajor < 2;
};

module.exports.check = function check(stats, url, browser) {
  const otherAsset = Object.keys(stats.compilation.assets).find(key => key !== 'index.js' && key.endsWith(".js"));
  fs.writeFileSync('dist/' + otherAsset, 'console.log("corrupted");');

  return defaultCheck(stats, url, browser);
};
