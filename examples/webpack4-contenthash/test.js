var webpackVersionComponents = require('webpack/package.json').version.split(
  '.'
);
var webpackVersionMajor = Number(webpackVersionComponents[0]);
var webpackVersionMinor = Number(webpackVersionComponents[0]);

module.exports.skip = function skip() {
  return (
    webpackVersionMajor < 4 ||
    (webpackVersionMajor === 4 && webpackVersionMinor < 3)
  );
};
