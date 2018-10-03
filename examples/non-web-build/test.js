var expect = require('expect');
var webpackVersion = Number(
  require('webpack/package.json').version.split('.')[0]
);

module.exports.skip = function skip() {
  // No reliable way to detect JsonWebTemplate usage on Webpack < 4.
  return webpackVersion < 4;
};

module.exports.check = function check(stats) {
  expect(stats.compilation.errors).toEqual([]);
  expect(stats.compilation.warnings.length).toEqual(1);
  expect(stats.compilation.warnings[0].message).toMatch(
    /This plugin is not useful for non-web targets/
  );
};
