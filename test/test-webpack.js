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
var ExtractTextPluginVersion = require('extract-text-webpack-plugin/package.json').version;
var CommonsChunkPlugin = require('webpack/lib/optimize/CommonsChunkPlugin');

describe('webpack-subresource-integrity', function describe() {
  it('should handle circular dependencies gracefully', function it(callback) {
    var tmpDir = tmp.dirSync();
    function cleanup() {
      fs.unlinkSync(path.join(tmpDir.name, 'bundle.js'));
      tmpDir.removeCallback();
    }
    var webpackConfig = {
      entry: {
        chunk1: path.join(__dirname, './chunk1.js'),
        chunk2: path.join(__dirname, './chunk2.js')
      },
      output: {
        path: tmpDir.name,
        filename: 'bundle.js'
      },
      plugins: [
        new CommonsChunkPlugin({ name: 'chunk1', chunks: ['chunk2'] }),
        new CommonsChunkPlugin({ name: 'chunk2', chunks: ['chunk1'] }),
        new SriPlugin(['sha256', 'sha384'])
      ]
    };
    webpack(webpackConfig, function webpackCallback(err, result) {
      cleanup();

      expect(result.compilation.assets['bundle.js'].integrity).toMatch(/^sha/);

      callback(err);
    });
  });
});

describe('html-webpack-plugin', function describe() {
  it('should warn when the checksum cannot be found', function it(callback) {
    var tmpDir = tmp.dirSync();
    function cleanup() {
      fs.unlinkSync(path.join(tmpDir.name, 'index.html'));
      fs.unlinkSync(path.join(tmpDir.name, 'test.png'));
      fs.unlinkSync(path.join(tmpDir.name, 'bundle.js'));
      tmpDir.removeCallback();
    }
    var webpackConfig = {
      entry: path.join(__dirname, './a.js'),
      output: {
        path: tmpDir.name,
        filename: 'bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({ favicon: 'test/test.png' }),
        new SriPlugin(['sha256', 'sha384'])
      ]
    };
    webpack(webpackConfig, function webpackCallback(err, result) {
      expect(result.compilation.warnings.length).toEqual(1);
      expect(result.compilation.warnings[0]).toBeAn(Error);
      expect(result.compilation.warnings[0].message).toEqual(
        "webpack-subresource-integrity: cannot determine hash for asset 'test.png', the resource will be unprotected."
      );
      cleanup();
      callback(err);
    });
  });

  it('should include integrity attributes in output', function it(callback) {
    var tmpDir = tmp.dirSync();
    function cleanup() {
      fs.unlinkSync(path.join(tmpDir.name, 'index.html'));
      fs.unlinkSync(path.join(tmpDir.name, 'styles.css'));
      fs.unlinkSync(path.join(tmpDir.name, 'bundle.js'));
      tmpDir.removeCallback();
    }
    var extractTextLoader;
    if (ExtractTextPluginVersion.match(/^1\./)) {
      // extract-text-webpack-plugin 1.x
      extractTextLoader = ExtractTextPlugin.extract('style-loader', 'css-loader');
    } else {
      // extract-text-webpack-plugin 2.x
      extractTextLoader = ExtractTextPlugin.extract({ fallbackLoader: 'style-loader', loader: 'css-loader' });
    }
    var webpackConfig = {
      entry: path.join(__dirname, './dummy.js'),
      output: {
        path: tmpDir.name,
        filename: 'bundle.js'
      },
      module: {
        loaders: [
          { test: /\.css$/, loader: extractTextLoader }
        ]
      },
      plugins: [
        new HtmlWebpackPlugin({ hash: true }),
        new ExtractTextPlugin('styles.css'),
        new SriPlugin(['sha256', 'sha384'])
      ]
    };
    webpack(webpackConfig, function webpackCallback(err, result) {
      if (err) {
        cleanup();
        callback(err);
      }
      var jsIntegrity = result.compilation.assets['bundle.js'].integrity;
      expect(jsIntegrity).toMatch(/^sha/);
      var cssIntegrity = result.compilation.assets['styles.css'].integrity;
      expect(cssIntegrity).toMatch(/^sha/);

      var handler = new htmlparser.DefaultHandler(function htmlparserCallback(error, dom) {
        if (error) {
          cleanup();
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

          cleanup();
          callback();
        }
      });
      var parser = new htmlparser.Parser(handler);
      parser.parseComplete(fs.readFileSync(path.join(tmpDir.name, 'index.html'), 'utf-8'));
    });
  });

  it('should work with subdirectories', function it(callback) {
    var tmpDir = tmp.dirSync();
    function cleanup() {
      fs.unlinkSync(path.join(tmpDir.name, 'assets/admin.html'));
      fs.unlinkSync(path.join(tmpDir.name, 'subdir/bundle.js'));
      fs.rmdirSync(path.join(tmpDir.name, 'assets'));
      fs.rmdirSync(path.join(tmpDir.name, 'subdir'));
      tmpDir.removeCallback();
    }
    var webpackConfig = {
      entry: path.join(__dirname, './dummy.js'),
      output: {
        path: tmpDir.name,
        filename: 'subdir/bundle.js'
      },
      plugins: [
        new HtmlWebpackPlugin({
          hash: true,
          filename: 'assets/admin.html'
        }),
        new SriPlugin(['sha256', 'sha384'])
      ]
    };
    webpack(webpackConfig, function webpackCallback(err, result) {
      if (err) {
        cleanup();
        callback(err);
      }
      expect(result.compilation.warnings).toEqual([]);
      var jsIntegrity = result.compilation.assets['subdir/bundle.js'].integrity;
      expect(jsIntegrity).toMatch(/^sha/);

      var handler = new htmlparser.DefaultHandler(function htmlparserCallback(error, dom) {
        if (error) {
          cleanup();
          callback(error);
        } else {
          var scripts = select(dom, 'script');
          expect(scripts.length).toEqual(1);
          expect(scripts[0].attribs.crossorigin).toEqual('anonymous');
          expect(scripts[0].attribs.integrity).toEqual(jsIntegrity);

          cleanup();
          callback();
        }
      });
      var parser = new htmlparser.Parser(handler);
      parser.parseComplete(fs.readFileSync(path.join(tmpDir.name, 'assets/admin.html'), 'utf-8'));
    });
  });

  it('should work when setting publicPath', function it(callback) {
    var tmpDir = tmp.dirSync();
    function cleanup() {
      fs.unlinkSync(path.join(tmpDir.name, 'index.html'));
      fs.unlinkSync(path.join(tmpDir.name, 'bundle.js'));
      tmpDir.removeCallback();
    }
    var webpackConfig = {
      entry: path.join(__dirname, './dummy.js'),
      output: {
        path: tmpDir.name,
        filename: 'bundle.js',
        publicPath: '/'
      },
      plugins: [
        new HtmlWebpackPlugin(),
        new SriPlugin(['sha256', 'sha384'])
      ]
    };
    webpack(webpackConfig, function webpackCallback(err, result) {
      if (err) {
        cleanup();
        callback(err);
      }
      expect(result.compilation.warnings).toEqual([]);
      var jsIntegrity = result.compilation.assets['bundle.js'].integrity;
      expect(jsIntegrity).toMatch(/^sha/);

      var handler = new htmlparser.DefaultHandler(function htmlparserCallback(error, dom) {
        if (error) {
          cleanup();
          callback(error);
        } else {
          var scripts = select(dom, 'script');
          expect(scripts.length).toEqual(1);
          expect(scripts[0].attribs.crossorigin).toEqual('anonymous');
          expect(scripts[0].attribs.integrity).toEqual(jsIntegrity);

          cleanup();
          callback();
        }
      });
      var parser = new htmlparser.Parser(handler);
      parser.parseComplete(fs.readFileSync(path.join(tmpDir.name, 'index.html'), 'utf-8'));
    });
  });
});
