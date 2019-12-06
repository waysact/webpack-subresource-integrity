var webpackVersion = Number(
  require('webpack/package.json').version.split('.')[0]
);

module.exports.skip = function skip() {
  // mini-css-extract-plugin needs Webpack 4
  return webpackVersion !== 4;
};
