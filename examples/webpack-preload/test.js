var webpackVersion = Number(
  require('webpack/package.json').version.split('.')[0]
);

module.exports.skip = function skip() {
  // webpack-preload tag requires Webpack 4
  return webpackVersion < 4;
};
