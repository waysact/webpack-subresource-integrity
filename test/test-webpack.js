var webpack = require('webpack');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var path = require('path');
var SriPlugin = require('../index');
var htmlparser = require('htmlparser');
var fs = require('fs');
var select = require('soupselect').select;
var expect = require('expect');
var tmp = require('tmp');
var ExtractTextPlugin = require('extract-text-webpack-plugin');

describe('html-webpack-plugin', function describe() {
  it('should include integrity attributes in output', function it(callback) {
    var tmpDir = tmp.dirSync();
    var webpackConfig = {
      entry: path.join(__dirname, './dummy.js'),
      output: {
        path: tmpDir.name
      },
      module: {
        loaders: [
          { test: /\.css$/, loader: ExtractTextPlugin.extract('style-loader', 'css-loader') }
        ]
      },
      plugins: [
        new HtmlWebpackPlugin(),
        new ExtractTextPlugin('styles.css'),
        new SriPlugin(['sha256', 'sha384'])
      ]
    };
    webpack(webpackConfig, function webpackCallback(err, result) {
      if (err) {
        return callback(err);
      }
      var jsIntegrity = result.compilation.assets['bundle.js'].integrity;
      expect(jsIntegrity).toMatch(/^sha/);
      var cssIntegrity = result.compilation.assets['styles.css'].integrity;
      expect(cssIntegrity).toMatch(/^sha/);

      var handler = new htmlparser.DefaultHandler(function htmlparserCallback(error, dom) {
        if (error) {
          callback(error);
        } else {
          var scripts = select(dom, 'script');
          expect(scripts.length).toEqual(1);
          expect(scripts[0].attribs.crossorigin).toEqual('anonymous');
          expect(scripts[0].attribs.integrity).toEqual(jsIntegrity);

          var links = select(dom, 'link');
          expect(links.length).toEqual(1);
          expect(links[0].attribs.crossorigin).toEqual('anonymous');
          expect(links[0].attribs.integrity).toEqual(cssIntegrity);

          callback();
        }
      });
      var parser = new htmlparser.Parser(handler);
      parser.parseComplete(fs.readFileSync(path.join(tmpDir.name, 'index.html'), 'utf-8'));
      tmpDir.removeCallback();
    });
  });
});
