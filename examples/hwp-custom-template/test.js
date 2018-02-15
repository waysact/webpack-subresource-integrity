var select = require('soupselect').select;
var expect = require('expect');
var htmlparser = require('htmlparser');
var fs = require('fs');

module.exports.check = function check(stats) {
  var jsIntegrity;
  var cssIntegrity;

  expect(stats.compilation.warnings).toEqual([]);
  jsIntegrity = stats.compilation.assets['subdir/bundle.js'].integrity;
  expect(jsIntegrity).toMatch(/^sha/);
  cssIntegrity = stats.compilation.assets['subdir/styles.css'].integrity;
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
      fs.readFileSync('./dist/admin.html', 'utf-8')
    );
  });
};
