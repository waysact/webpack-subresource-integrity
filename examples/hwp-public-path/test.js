var select = require('soupselect').select;
var expect = require('expect');
var htmlparser = require('htmlparser');
var fs = require('fs');

module.exports.check = function check(stats) {
  var jsIntegrity;

  expect(stats.compilation.warnings).toEqual([]);
  jsIntegrity =
    stats.toJson().assets.find(asset => asset.name === 'bundle.js').integrity ||
    stats.compilation.assets['bundle.js'].integrity;
  expect(jsIntegrity).toMatch(/^sha/);

  return new Promise((resolve, reject) => {
    var handler = new htmlparser.DefaultHandler(function htmlparserCallback(
      error,
      dom
    ) {
      var scripts;

      if (error) {
        reject(error);
        return;
      }
      scripts = select(dom, 'script');
      expect(scripts.length).toEqual(1);
      expect(scripts[0].attribs.crossorigin).toEqual('anonymous');
      expect(scripts[0].attribs.integrity).toEqual(jsIntegrity);

      resolve();
    });
    new htmlparser.Parser(handler).parseComplete(
      fs.readFileSync('./dist/index.html', 'utf-8')
    );
  });
};
