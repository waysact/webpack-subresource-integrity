var expect = require('expect');
var webpackVersion = Number(
  require('webpack/package.json').version.split('.')[0]
);

module.exports.skip = function skip() {
  return webpackVersion < 4;
};

module.exports.check = function check(stats) {
  expect(stats.compilation.assets['asset_copy.txt'].integrity).toEqual(
    'sha256-wibhg9oz2c6SWYeRXr5Gm41ZEMI2cTMnzXY6XvKESaI= sha384-qT+SO7B2fXBg/6LmmCLeaJWxIetW8W1rbbgh0dXt/zvt9biphdWNCBfg/nyrsT2m'
  );
};
