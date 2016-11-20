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
var crypto = require('crypto');

function createExtractTextLoader() {
  if (ExtractTextPluginVersion.match(/^1\./)) {
    // extract-text-webpack-plugin 1.x
    return ExtractTextPlugin.extract('style-loader', 'css-loader');
  }
  // extract-text-webpack-plugin 2.x
  return ExtractTextPlugin.extract({ fallbackLoader: 'style-loader', loader: 'css-loader' });
}

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

  it('supports multiple compilation', function it(callback) {
    var tmpDir = tmp.dirSync();

    var mainJs = path.join(tmpDir.name, 'main.js');
    var otherJs = path.join(tmpDir.name, 'other.js');

    var oldOtherJsSource = 'console.log("hello");';
    var newOtherJsSource = 'console.log("hello2");';

    fs.writeFileSync(mainJs, 'require.ensure(["./other.js"], function(require) { require("./other.js"); });');
    fs.writeFileSync(otherJs, oldOtherJsSource);

    function cleanup(err) {
      fs.unlinkSync(path.join(tmpDir.name, 'chunk.js'));
      fs.unlinkSync(path.join(tmpDir.name, 'bundle.js'));
      fs.unlinkSync(path.join(tmpDir.name, 'main.js'));
      fs.unlinkSync(path.join(tmpDir.name, 'other.js'));
      tmpDir.removeCallback();
      callback(err);
    }
    var webpackConfig = {
      entry: {
        bundle: mainJs
      },
      output: {
        path: tmpDir.name,
        filename: 'bundle.js',
        chunkFilename: 'chunk.js'
      },
      plugins: [
        new SriPlugin(['sha256', 'sha384'])
      ]
    };
    var compiler = webpack(webpackConfig);
    var watching;
    var callbackCount = 0;
    function handler(err) {
      if (err) {
        cleanup(err);
        return;
      }

      if (callbackCount === 0) {
        setTimeout(function updateCode() {
          fs.writeFileSync(otherJs, newOtherJsSource);
        }, 1000); // FIXME -- brittle and slow
        callbackCount += 1;
      } else if (callbackCount === 1) {
        var chunkContents = fs.readFileSync(path.join(tmpDir.name, 'chunk.js'), 'utf-8');
        var bundleContents = fs.readFileSync(path.join(tmpDir.name, 'bundle.js'), 'utf-8');

        if (chunkContents.indexOf(newOtherJsSource) >= 0) {
          callbackCount += 1;
          watching.close(function afterClose() {
            expect(bundleContents).toMatch(/script\.integrity =/);
            var hash = crypto.createHash('sha256').update(chunkContents, 'utf8').digest('base64');
            var regex = /sha256-([^ ]+)/g;
            var match = regex.exec(bundleContents);
            expect(match).toExist();
            expect(match[1]).toEqual(hash);
            expect(regex.exec(bundleContents)).toNotExist();
            cleanup(err);
          });
        }
      }
    }
    watching = compiler.watch({ aggregateTimeout: 0 }, handler);
  });

  [[0, 1], [1, 0]].forEach(function withPluginOrder(pluginOrder) {
    var algo = 'sha256';
    var plugins = [
      new webpack.optimize.UglifyJsPlugin(),
      new SriPlugin([algo])
    ];
    it('should work with plugin order ' + pluginOrder,
       function it(callback) {
         var tmpDir = tmp.dirSync();
         function cleanup() {
           fs.unlinkSync(path.join(tmpDir.name, 'bundle.js'));
           tmpDir.removeCallback();
         }
         var webpackConfig = {
           entry: path.join(__dirname, './dummy.js'),
           output: {
             path: tmpDir.name,
             filename: 'bundle.js'
           },
           plugins: [
             plugins[pluginOrder[0]],
             plugins[pluginOrder[1]]
           ]
         };
         webpack(webpackConfig, function webpackCallback(err, result) {
           var source = fs.readFileSync(path.join(tmpDir.name, 'bundle.js'), 'utf8');
           var hash = crypto.createHash(algo).update(source, 'utf8').digest('base64');
           expect(result.compilation.assets['bundle.js'].integrity)
             .toEqual(algo + '-' + hash);

           cleanup();
           callback(err);
         });
       });
  });

  it('should warn when used with HMR', function it(callback) {
    var tmpDir = tmp.dirSync();
    function cleanup(err) {
      fs.unlinkSync(path.join(tmpDir.name, 'bundle.js'));
      tmpDir.removeCallback();
      callback(err);
    }
    var webpackConfig = {
      entry: path.join(__dirname, './dummy.js'),
      output: {
        path: tmpDir.name,
        filename: 'bundle.js'
      },
      plugins: [
        new webpack.HotModuleReplacementPlugin(),
        new SriPlugin(['sha256', 'sha384'])
      ]
    };
    webpack(webpackConfig, function webpackCallback(err, result) {
      expect(result.compilation.warnings.length).toEqual(1);
      expect(result.compilation.warnings[0]).toBeAn(Error);
      expect(result.compilation.warnings[0].message).toEqual(
        'webpack-subresource-integrity: chunks loaded by HMR are unprotected.'
      );
      cleanup(err);
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
    var webpackConfig = {
      entry: path.join(__dirname, './dummy.js'),
      output: {
        path: tmpDir.name,
        filename: 'bundle.js'
      },
      module: {
        loaders: [
          { test: /\.css$/, loader: createExtractTextLoader() }
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

  it('should work with subdirectories and a custom template', function it(callback) {
    var tmpDir = tmp.dirSync();
    function cleanup() {
      fs.unlinkSync(path.join(tmpDir.name, 'admin.html'));
      fs.unlinkSync(path.join(tmpDir.name, 'subdir/styles.css'));
      fs.unlinkSync(path.join(tmpDir.name, 'subdir/bundle.js'));
      fs.rmdirSync(path.join(tmpDir.name, 'subdir'));
      tmpDir.removeCallback();
    }
    var webpackConfig = {
      entry: path.join(__dirname, './dummy.js'),
      output: {
        path: tmpDir.name,
        filename: 'subdir/bundle.js'
      },
      module: {
        loaders: [
          { test: /\.css$/, loader: createExtractTextLoader() }
        ]
      },
      plugins: [
        new HtmlWebpackPlugin({
          hash: true,
          inject: false,
          filename: 'admin.html',
          template: path.join(__dirname, 'index.ejs')
        }),
        new ExtractTextPlugin('subdir/styles.css'),
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
      var cssIntegrity = result.compilation.assets['subdir/styles.css'].integrity;
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
      parser.parseComplete(fs.readFileSync(path.join(tmpDir.name, 'admin.html'), 'utf-8'));
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

  it('should work with output HTML in parent directory', function it(callback) {
    var tmpDir = tmp.dirSync();
    var subDir = path.join(tmpDir.name, 'sub');

    function cleanup() {
      fs.unlinkSync(path.join(tmpDir.name, 'index.html'));
      fs.unlinkSync(path.join(subDir, 'bundle.js'));
      fs.rmdirSync(subDir);
      tmpDir.removeCallback();
    }
    var webpackConfig = {
      entry: {
        main: path.join(__dirname, './dummy.js')
      },
      output: {
        path: subDir,
        filename: 'bundle.js',
        publicPath: '/'
      },
      plugins: [
        new HtmlWebpackPlugin({
          filename: '../index.html',
          chunks: ['main']
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
