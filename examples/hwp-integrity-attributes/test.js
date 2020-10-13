var select = require('soupselect').select;
var expect = require('expect');
var htmlparser = require('htmlparser');
var fs = require('fs');
var webpackVersion = Number(
  require('webpack/package.json').version.split('.')[0]
);

module.exports.skip = function skip() {
  // Can't use extract-text-webpack-plugin with Webpack > 4.
  return webpackVersion > 4;
};

module.exports.check = function check(stats) {
  var jsIntegrity;
  var cssIntegrity;

  jsIntegrity = stats.compilation.assets['bundle.js'].integrity;
  expect(jsIntegrity).toMatch(/^sha/);
  cssIntegrity = stats.compilation.assets['styles.css'].integrity;
  expect(cssIntegrity).toMatch(/^sha/);

  return new Promise((resolve, reject) => {
    var handler = new htmlparser.DefaultHandler(function htmlparserCallback(
      error,
      dom
    ) {
      var scripts;
      var links;

      if (error) {
        reject(error);
        return;
      }

      scripts = select(dom, 'script');
      expect(scripts.length).toEqual(1);
      expect(scripts[0].attribs.crossorigin).toEqual('anonymous');
      expect(scripts[0].attribs.integrity).toEqual(jsIntegrity);

      links = select(dom, 'link');
      expect(links.length).toEqual(1);
      expect(links[0].attribs.crossorigin).toEqual('anonymous');
      expect(links[0].attribs.integrity).toEqual(cssIntegrity);

      resolve();
    });
    new htmlparser.Parser(handler).parseComplete(
      fs.readFileSync('dist/index.html', 'utf-8')
    );
  });
};
