var select = require('soupselect').select;
var expect = require('expect');
var htmlparser = require('htmlparser');
var fs = require('fs');

module.exports.check = function check(stats) {
  expect(stats.compilation.warnings).toEqual([]);

  return new Promise((resolve, reject) => {
    var handler = new htmlparser.DefaultHandler(function htmlparserCallback(
      error,
      dom
    ) {
      var scripts;
      var i;

      if (error) {
        reject(error);
        return;
      }
      scripts = select(dom, 'script');
      expect(scripts.length).toEqual(2);
      for (i = 0; i < scripts.length; i += 1) {
        expect(scripts[0].attribs.crossorigin).toEqual('anonymous');
        expect(scripts[0].attribs.integrity).toMatch(/^sha/);
      }

      resolve();
    });
    new htmlparser.Parser(handler).parseComplete(
      fs.readFileSync('./dist/index.html', 'utf-8')
    );
  });
};
