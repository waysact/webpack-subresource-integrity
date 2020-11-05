var webpackVersionComponents = require('webpack/package.json').version.split(
  '.'
);
var webpackVersionMajor = Number(webpackVersionComponents[0]);

module.exports.skip = function skip() {
  return webpackVersionMajor < 5;
};
