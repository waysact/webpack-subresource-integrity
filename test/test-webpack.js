var webpack = require('webpack');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var path = require('path');
var SriPlugin = require('../index');
var htmlparser = require('htmlparser');
var fs = require('fs');
var select = require('soupselect').select;
var expect = require('expect');
var tmp = require('tmp');

describe('html-webpack-plugin', function describe() {
  it('should include integrity attributes in output', function it(callback) {
    var tmpDir = tmp.dirSync();
    var webpackConfig = {
      entry: path.join(__dirname, './chunk1.js'),
      output: {
        path: tmpDir.name
      },
      plugins: [
        new HtmlWebpackPlugin({ title: 'foo' }),
        new SriPlugin(['sha256', 'sha384'])
      ]
    };
    webpack(webpackConfig, function webpackCallback(err, result) {
      var integrity = result.compilation.assets['bundle.js'].integrity;
      expect(integrity).toMatch(/^sha/);
      if (err) {
        callback(err);
      }
      var handler = new htmlparser.DefaultHandler(function htmlparserCallback(error, dom) {
        if (error) {
          callback(error);
        } else {
          var scripts = select(dom, 'script');
          expect(scripts.length).toEqual(1);
          expect(scripts[0].attribs.crossorigin).toEqual('anonymous');
          expect(scripts[0].attribs.integrity).toEqual(integrity);
          callback();
        }
      });
      var parser = new htmlparser.Parser(handler);
      parser.parseComplete(fs.readFileSync(path.join(tmpDir.name, 'index.html'), 'utf-8'));
      tmpDir.removeCallback();
    });
  });
});
