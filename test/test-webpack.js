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
var glob = require('glob');
var vm = require('vm');

function createExtractTextLoader() {
  if (ExtractTextPluginVersion.match(/^1\./)) {
    // extract-text-webpack-plugin 1.x
    return ExtractTextPlugin.extract('style-loader', 'css-loader');
  }
  // extract-text-webpack-plugin 2.x
  return ExtractTextPlugin.extract({ fallback: 'style-loader', use: 'css-loader' });
}

function testCompilation() {
  return {
    warnings: [],
    errors: [],
    compiler: {
      options: {
        output: {
          crossOriginLoading: 'anonymous'
        }
      }
    }
  };
}

describe('webpack-subresource-integrity', function describe() {
  it('should handle circular dependencies gracefully', function it(callback) {
    var tmpDir = tmp.dirSync();
    var webpackConfig;
    function cleanup() {
      fs.unlinkSync(path.join(tmpDir.name, 'bundle.js'));
      tmpDir.removeCallback();
    }
    webpackConfig = {
      entry: {
        chunk1: path.join(__dirname, './chunk1.js'),
        chunk2: path.join(__dirname, './chunk2.js')
      },
      output: {
        path: tmpDir.name,
        filename: 'bundle.js',
        crossOriginLoading: 'anonymous'
      },
      plugins: [
        new CommonsChunkPlugin({ name: 'chunk1', chunks: ['chunk2'] }),
        new CommonsChunkPlugin({ name: 'chunk2', chunks: ['chunk1'] }),
        new SriPlugin({ hashFuncNames: ['sha256', 'sha384'] })
      ]
    };
    webpack(webpackConfig, function webpackCallback(err, result) {
      cleanup();

      expect(result.compilation.assets['bundle.js'].integrity).toMatch(/^sha/);

      callback(err);
    });
  });

  it('handles mutually dependent chunks', function it(callback) {
    var tmpDir = tmp.dirSync();
    var mainJs = path.join(tmpDir.name, 'main.js');
    var chunk1Js = path.join(tmpDir.name, 'chunk1.js');
    var chunk2Js = path.join(tmpDir.name, 'chunk2.js');
    var chunk3Js = path.join(tmpDir.name, 'chunk3.js');
    var webpackConfig;

    fs.writeFileSync(mainJs, 'require.ensure([], function(require) { require("./chunk1.js"); });');
    fs.writeFileSync(chunk1Js, 'require.ensure([], function(require) { require("./chunk2.js"); });');
    fs.writeFileSync(chunk2Js, 'require.ensure([], function(require) { require("./chunk3.js"); });');
    fs.writeFileSync(chunk3Js, 'require.ensure([], function(require) { require("./chunk1.js"); });');

    function cleanup(err) {
      fs.unlinkSync(path.join(tmpDir.name, 'main.js'));
      fs.unlinkSync(path.join(tmpDir.name, 'chunk1.js'));
      fs.unlinkSync(path.join(tmpDir.name, 'chunk2.js'));
      fs.unlinkSync(path.join(tmpDir.name, 'chunk3.js'));
      fs.unlinkSync(path.join(tmpDir.name, 'bundle.js'));
      glob.sync(path.join(tmpDir.name, '*.bundle.js')).forEach(fs.unlinkSync);
      tmpDir.removeCallback();
      callback(err);
    }

    webpackConfig = {
      entry: mainJs,
      output: {
        path: tmpDir.name,
        filename: 'bundle.js',
        crossOriginLoading: 'anonymous'
      },
      plugins: [
        new SriPlugin({ hashFuncNames: ['sha256', 'sha384'] })
      ]
    };
    webpack(webpackConfig, function webpackCallback(err, result) {
      expect(result.compilation.errors.length).toEqual(0);
      expect(result.compilation.warnings.length).toEqual(0);
      cleanup(err);
    });
  });

  it('supports multiple compilation', function it(callback) {
    var tmpDir = tmp.dirSync();
    var mainJs = path.join(tmpDir.name, 'main.js');
    var otherJs = path.join(tmpDir.name, 'other.js');
    var oldOtherJsSource = 'console.log("hello");';
    var newOtherJsSource = 'console.log("hello2");';
    var watching;
    var callbackCount = 0;
    var webpackConfig;
    var compiler;

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
    webpackConfig = {
      entry: {
        bundle: mainJs
      },
      output: {
        path: tmpDir.name,
        filename: 'bundle.js',
        chunkFilename: 'chunk.js',
        crossOriginLoading: 'anonymous'
      },
      plugins: [
        new SriPlugin({ hashFuncNames: ['sha256', 'sha384'] })
      ]
    };
    compiler = webpack(webpackConfig);
    function handler(err) {
      var chunkContents;
      var bundleContents;
      var hash;
      var regex;
      var match;
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
        chunkContents = fs.readFileSync(path.join(tmpDir.name, 'chunk.js'), 'utf-8');
        bundleContents = fs.readFileSync(path.join(tmpDir.name, 'bundle.js'), 'utf-8');

        if (chunkContents.indexOf(newOtherJsSource) >= 0) {
          callbackCount += 1;
          watching.close(function afterClose() {
            expect(bundleContents).toMatch(/script\.integrity =/);
            hash = crypto.createHash('sha256').update(chunkContents, 'utf8').digest('base64');
            regex = /sha256-([^ ]+)/g;
            match = regex.exec(bundleContents);
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
      new SriPlugin({ hashFuncNames: [algo] })
    ];
    it('should work with plugin order ' + pluginOrder,
       function it(callback) {
         var tmpDir = tmp.dirSync();
         var webpackConfig;
         function cleanup() {
           fs.unlinkSync(path.join(tmpDir.name, 'bundle.js'));
           tmpDir.removeCallback();
         }
         webpackConfig = {
           entry: path.join(__dirname, './dummy.js'),
           output: {
             path: tmpDir.name,
             filename: 'bundle.js',
             crossOriginLoading: 'anonymous'
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

  it('should warn when used with hot reloading', function it(callback) {
    var tmpDir = tmp.dirSync();
    var webpackConfig;
    function cleanup(err) {
      fs.unlinkSync(path.join(tmpDir.name, 'bundle.js'));
      tmpDir.removeCallback();
      callback(err);
    }
    webpackConfig = {
      entry: path.join(__dirname, './dummy.js'),
      output: {
        path: tmpDir.name,
        filename: 'bundle.js',
        crossOriginLoading: 'anonymous'
      },
      plugins: [
        new webpack.HotModuleReplacementPlugin(),
        new SriPlugin({ hashFuncNames: ['sha256', 'sha384'] })
      ]
    };
    webpack(webpackConfig, function webpackCallback(err, result) {
      expect(result.compilation.warnings.length).toEqual(1);
      expect(result.compilation.warnings[0]).toBeAn(Error);
      expect(result.compilation.warnings[0].message).toMatch(
          /may interfere with hot reloading./);
      cleanup(err);
    });
  });

  it('can be disabled', function it(callback) {
    var tmpDir = tmp.dirSync();
    var webpackConfig;
    function cleanup(err) {
      fs.unlinkSync(path.join(tmpDir.name, 'bundle.js'));
      fs.unlinkSync(path.join(tmpDir.name, 'styles.css'));
      tmpDir.removeCallback();
      callback(err);
    }
    webpackConfig = {
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
        new ExtractTextPlugin('styles.css'),
        new SriPlugin({ hashFuncNames: ['sha256'], enabled: false })
      ]
    };
    webpack(webpackConfig, function webpackCallback(err, result) {
      expect(typeof result.compilation.assets['bundle.js'].integrity).toBe('undefined');
      expect(result.compilation.warnings).toEqual([]);
      expect(result.compilation.errors).toEqual([]);
      cleanup(err);
    });
  });

  it('should error when code splitting is used with crossOriginLoading', function it(callback) {
    var tmpDir = tmp.dirSync();
    var webpackConfig;
    function cleanup(err) {
      fs.unlinkSync(path.join(tmpDir.name, 'bundle.js'));
      try {
        fs.unlinkSync(path.join(tmpDir.name, '0.bundle.js'));
      } catch (e) {
        fs.unlinkSync(path.join(tmpDir.name, '1.bundle.js'));
      }
      tmpDir.removeCallback();
      callback(err);
    }
    webpackConfig = {
      entry: path.join(__dirname, './chunk1.js'),
      output: {
        path: tmpDir.name,
        filename: 'bundle.js'
      },
      plugins: [
        new SriPlugin({ hashFuncNames: ['sha256', 'sha384'] })
      ]
    };
    webpack(webpackConfig, function webpackCallback(err, result) {
      expect(result.compilation.warnings.length).toEqual(1);
      expect(result.compilation.warnings[0]).toBeAn(Error);
      expect(result.compilation.warnings[0].message).toMatch(
          /Set webpack option output.crossOriginLoading when using this plugin/);
      expect(result.compilation.errors.length).toEqual(1);
      expect(result.compilation.errors[0]).toBeAn(Error);
      expect(result.compilation.errors[0].message).toMatch(
          /webpack option output.crossOriginLoading not set, code splitting will not work!/);
      cleanup(err);
    });
  });
});

describe('plugin options', function describe() {
  it('throws an error when options is not an object', function it() {
    expect(function block() {
      new SriPlugin(function dummy() {}); // eslint-disable-line no-new
    }).toThrow(/argument must be an object/);
  });

  it('warns when no hash function names are specified', function it() {
    var plugin = new SriPlugin();
    var dummyCompilation = testCompilation();
    expect(plugin.options.hashFuncNames).toBeFalsy();
    expect(plugin.options.deprecatedOptions).toBeFalsy();
    plugin.validateOptions(dummyCompilation);
    expect(dummyCompilation.errors.length).toBe(1);
    expect(dummyCompilation.warnings.length).toBe(0);
    expect(dummyCompilation.errors[0]).toBeAn(Error);
    expect(dummyCompilation.errors[0].message).toMatch(
        /hashFuncNames must be an array of hash function names, instead got 'undefined'/);
  });

  it('warns when no standard hash function name is specified', function it() {
    var plugin = new SriPlugin({
      hashFuncNames: ['md5']
    });
    var dummyCompilation = testCompilation();
    expect(plugin.options.hashFuncNames).toEqual(['md5']);
    expect(plugin.options.deprecatedOptions).toBeFalsy();
    plugin.validateOptions(dummyCompilation);
    expect(dummyCompilation.errors.length).toBe(0);
    expect(dummyCompilation.warnings.length).toBe(1);
    expect(dummyCompilation.warnings[0]).toBeAn(Error);
    expect(dummyCompilation.warnings[0].message).toMatch(new RegExp(
      'It is recommended that at least one hash function is part of ' +
        'the set for which support is mandated by the specification'));
  });

  it('supports new constructor with array of hash function names', function it() {
    var plugin = new SriPlugin({
      hashFuncNames: ['sha256', 'sha384']
    });
    var dummyCompilation = testCompilation();
    expect(plugin.options.hashFuncNames).toEqual(['sha256', 'sha384']);
    expect(plugin.options.deprecatedOptions).toBeFalsy();
    plugin.validateOptions(dummyCompilation);
    expect(dummyCompilation.errors.length).toBe(0);
    expect(dummyCompilation.warnings.length).toBe(0);
  });

  it('errors if hash function names is not an array', function it() {
    var plugin = new SriPlugin({
      hashFuncNames: 'sha256'
    });
    var dummyCompilation = testCompilation();
    plugin.validateOptions(dummyCompilation);
    expect(dummyCompilation.errors.length).toBe(1);
    expect(dummyCompilation.warnings.length).toBe(0);
    expect(dummyCompilation.errors[0].message).toMatch(
        /options.hashFuncNames must be an array of hash function names, instead got 'sha256'/);
    expect(plugin.options.enabled).toBeFalsy();
  });

  it('errors if hash function names contains non-string', function it() {
    var plugin = new SriPlugin({
      hashFuncNames: [1234]
    });
    var dummyCompilation = testCompilation();
    plugin.validateOptions(dummyCompilation);
    expect(dummyCompilation.errors.length).toBe(1);
    expect(dummyCompilation.warnings.length).toBe(0);
    expect(dummyCompilation.errors[0].message).toMatch(
        /options.hashFuncNames must be an array of hash function names, but contained 1234/);
    expect(plugin.options.enabled).toBeFalsy();
  });

  it('errors if hash function names contains unsupported digest', function it() {
    var plugin = new SriPlugin({
      hashFuncNames: ['frobnicate']
    });
    var dummyCompilation = testCompilation();
    plugin.validateOptions(dummyCompilation);
    expect(dummyCompilation.errors.length).toBe(1);
    expect(dummyCompilation.warnings.length).toBe(0);
    expect(dummyCompilation.errors[0].message).toMatch(
        /Cannot use hash function 'frobnicate': Digest method not supported/);
    expect(plugin.options.enabled).toBeFalsy();
  });

  it('uses default options', function it() {
    var plugin = new SriPlugin({
      hashFuncNames: ['sha256']
    });
    var dummyCompilation;
    expect(plugin.options.hashFuncNames).toEqual(['sha256']);
    expect(plugin.options.enabled).toBeTruthy();
    expect(plugin.options.deprecatedOptions).toBeFalsy();
    dummyCompilation = testCompilation();
    plugin.validateOptions(dummyCompilation);
    expect(dummyCompilation.errors.length).toBe(0);
    expect(dummyCompilation.warnings.length).toBe(0);
  });

  it('should warn when output.crossOriginLoading is not set', function it() {
    var plugin = new SriPlugin({ hashFuncNames: ['sha256'] });
    var dummyCompilation = {
      warnings: [],
      errors: [],
      compiler: {
        options: {
          output: {
            crossOriginLoading: false
          }
        }
      }
    };
    plugin.validateOptions(dummyCompilation);
    expect(dummyCompilation.errors.length).toBe(0);
    expect(dummyCompilation.warnings.length).toBe(1);
    expect(dummyCompilation.warnings[0].message).toMatch(
        /Set webpack option output.crossOriginLoading when using this plugin/);
  });
});

describe('html-webpack-plugin', function describe() {
  it('should warn when the checksum cannot be found', function it(callback) {
    var tmpDir = tmp.dirSync();
    var webpackConfig;
    function cleanup() {
      fs.unlinkSync(path.join(tmpDir.name, 'index.html'));
      fs.unlinkSync(path.join(tmpDir.name, 'test.png'));
      fs.unlinkSync(path.join(tmpDir.name, 'bundle.js'));
      tmpDir.removeCallback();
    }
    webpackConfig = {
      entry: path.join(__dirname, './a.js'),
      output: {
        path: tmpDir.name,
        filename: 'bundle.js',
        crossOriginLoading: 'anonymous'
      },
      plugins: [
        new HtmlWebpackPlugin({ favicon: 'test/test.png' }),
        new SriPlugin({ hashFuncNames: ['sha256', 'sha384'] })
      ]
    };
    webpack(webpackConfig, function webpackCallback(err, result) {
      expect(result.compilation.warnings.length).toEqual(1);
      expect(result.compilation.warnings[0]).toBeAn(Error);
      expect(result.compilation.warnings[0].message).toEqual(
        "webpack-subresource-integrity: Cannot determine hash for asset 'test.png', the resource will be unprotected."
      );
      cleanup();
      callback(err);
    });
  });

  it('should include integrity attributes in output', function it(callback) {
    var tmpDir = tmp.dirSync();
    var webpackConfig;
    var jsIntegrity;
    var cssIntegrity;
    var scripts;
    var links;
    var handler;
    var parser;
    function cleanup() {
      fs.unlinkSync(path.join(tmpDir.name, 'index.html'));
      fs.unlinkSync(path.join(tmpDir.name, 'styles.css'));
      fs.unlinkSync(path.join(tmpDir.name, 'bundle.js'));
      tmpDir.removeCallback();
    }
    webpackConfig = {
      entry: path.join(__dirname, './dummy.js'),
      output: {
        path: tmpDir.name,
        filename: 'bundle.js',
        crossOriginLoading: 'anonymous'
      },
      module: {
        loaders: [
          { test: /\.css$/, loader: createExtractTextLoader() }
        ]
      },
      plugins: [
        new HtmlWebpackPlugin({ hash: true }),
        new ExtractTextPlugin('styles.css'),
        new SriPlugin({ hashFuncNames: ['sha256', 'sha384'] })
      ]
    };
    webpack(webpackConfig, function webpackCallback(err, result) {
      if (err) {
        cleanup();
        callback(err);
      }
      jsIntegrity = result.compilation.assets['bundle.js'].integrity;
      expect(jsIntegrity).toMatch(/^sha/);
      cssIntegrity = result.compilation.assets['styles.css'].integrity;
      expect(cssIntegrity).toMatch(/^sha/);

      handler = new htmlparser.DefaultHandler(function htmlparserCallback(error, dom) {
        if (error) {
          cleanup();
          callback(error);
        } else {
          scripts = select(dom, 'script');
          expect(scripts.length).toEqual(1);
          expect(scripts[0].attribs.crossorigin).toEqual('anonymous');
          expect(scripts[0].attribs.integrity).toEqual(jsIntegrity);

          links = select(dom, 'link');
          expect(links.length).toEqual(1);
          expect(links[0].attribs.crossorigin).toEqual('anonymous');
          expect(links[0].attribs.integrity).toEqual(cssIntegrity);

          cleanup();
          callback();
        }
      });
      parser = new htmlparser.Parser(handler);
      parser.parseComplete(fs.readFileSync(path.join(tmpDir.name, 'index.html'), 'utf-8'));
    });
  });

  it('should work with subdirectories', function it(callback) {
    var tmpDir = tmp.dirSync();
    var webpackConfig;
    var jsIntegrity;
    var scripts;
    var handler;
    var parser;
    function cleanup() {
      fs.unlinkSync(path.join(tmpDir.name, 'assets/admin.html'));
      fs.unlinkSync(path.join(tmpDir.name, 'subdir/bundle.js'));
      fs.rmdirSync(path.join(tmpDir.name, 'assets'));
      fs.rmdirSync(path.join(tmpDir.name, 'subdir'));
      tmpDir.removeCallback();
    }
    webpackConfig = {
      entry: path.join(__dirname, './dummy.js'),
      output: {
        path: tmpDir.name,
        filename: 'subdir/bundle.js',
        crossOriginLoading: 'anonymous'
      },
      plugins: [
        new HtmlWebpackPlugin({
          hash: true,
          filename: 'assets/admin.html'
        }),
        new SriPlugin({ hashFuncNames: ['sha256', 'sha384'] })
      ]
    };
    webpack(webpackConfig, function webpackCallback(err, result) {
      if (err) {
        cleanup();
        callback(err);
      }
      expect(result.compilation.warnings).toEqual([]);
      jsIntegrity = result.compilation.assets['subdir/bundle.js'].integrity;
      expect(jsIntegrity).toMatch(/^sha/);

      handler = new htmlparser.DefaultHandler(function htmlparserCallback(error, dom) {
        if (error) {
          cleanup();
          callback(error);
        } else {
          scripts = select(dom, 'script');
          expect(scripts.length).toEqual(1);
          expect(scripts[0].attribs.crossorigin).toEqual('anonymous');
          expect(scripts[0].attribs.integrity).toEqual(jsIntegrity);

          cleanup();
          callback();
        }
      });
      parser = new htmlparser.Parser(handler);
      parser.parseComplete(fs.readFileSync(path.join(tmpDir.name, 'assets/admin.html'), 'utf-8'));
    });
  });

  it('should work with subdirectories and a custom template', function it(callback) {
    var tmpDir = tmp.dirSync();
    var webpackConfig;
    var parser;
    var jsIntegrity;
    var cssIntegrity;
    var handler;
    var scripts;
    var links;
    function cleanup() {
      fs.unlinkSync(path.join(tmpDir.name, 'admin.html'));
      fs.unlinkSync(path.join(tmpDir.name, 'subdir/styles.css'));
      fs.unlinkSync(path.join(tmpDir.name, 'subdir/bundle.js'));
      fs.rmdirSync(path.join(tmpDir.name, 'subdir'));
      tmpDir.removeCallback();
    }
    webpackConfig = {
      entry: path.join(__dirname, './dummy.js'),
      output: {
        path: tmpDir.name,
        filename: 'subdir/bundle.js',
        crossOriginLoading: 'anonymous'
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
        new SriPlugin({ hashFuncNames: ['sha256', 'sha384'] })
      ]
    };
    webpack(webpackConfig, function webpackCallback(err, result) {
      if (err) {
        cleanup();
        callback(err);
      }
      expect(result.compilation.warnings).toEqual([]);
      jsIntegrity = result.compilation.assets['subdir/bundle.js'].integrity;
      expect(jsIntegrity).toMatch(/^sha/);
      cssIntegrity = result.compilation.assets['subdir/styles.css'].integrity;
      expect(cssIntegrity).toMatch(/^sha/);

      handler = new htmlparser.DefaultHandler(function htmlparserCallback(error, dom) {
        if (error) {
          cleanup();
          callback(error);
        } else {
          scripts = select(dom, 'script');
          expect(scripts.length).toEqual(1);
          expect(scripts[0].attribs.crossorigin).toEqual('anonymous');
          expect(scripts[0].attribs.integrity).toEqual(jsIntegrity);

          links = select(dom, 'link');
          expect(links.length).toEqual(1);
          expect(links[0].attribs.crossorigin).toEqual('anonymous');
          expect(links[0].attribs.integrity).toEqual(cssIntegrity);

          cleanup();
          callback();
        }
      });
      parser = new htmlparser.Parser(handler);
      parser.parseComplete(fs.readFileSync(path.join(tmpDir.name, 'admin.html'), 'utf-8'));
    });
  });

  it('should work when setting publicPath', function it(callback) {
    var tmpDir = tmp.dirSync();
    var webpackConfig;
    var parser;
    var jsIntegrity;
    var handler;
    var scripts;
    function cleanup() {
      fs.unlinkSync(path.join(tmpDir.name, 'index.html'));
      fs.unlinkSync(path.join(tmpDir.name, 'bundle.js'));
      tmpDir.removeCallback();
    }
    webpackConfig = {
      entry: path.join(__dirname, './dummy.js'),
      output: {
        path: tmpDir.name,
        filename: 'bundle.js',
        publicPath: '/',
        crossOriginLoading: 'anonymous'
      },
      plugins: [
        new HtmlWebpackPlugin(),
        new SriPlugin({ hashFuncNames: ['sha256', 'sha384'] })
      ]
    };
    webpack(webpackConfig, function webpackCallback(err, result) {
      if (err) {
        cleanup();
        callback(err);
      }
      expect(result.compilation.warnings).toEqual([]);
      jsIntegrity = result.compilation.assets['bundle.js'].integrity;
      expect(jsIntegrity).toMatch(/^sha/);

      handler = new htmlparser.DefaultHandler(function htmlparserCallback(error, dom) {
        if (error) {
          cleanup();
          callback(error);
        } else {
          scripts = select(dom, 'script');
          expect(scripts.length).toEqual(1);
          expect(scripts[0].attribs.crossorigin).toEqual('anonymous');
          expect(scripts[0].attribs.integrity).toEqual(jsIntegrity);

          cleanup();
          callback();
        }
      });
      parser = new htmlparser.Parser(handler);
      parser.parseComplete(fs.readFileSync(path.join(tmpDir.name, 'index.html'), 'utf-8'));
    });
  });

  it('should work with output HTML in parent directory', function it(callback) {
    var tmpDir = tmp.dirSync();
    var subDir = path.join(tmpDir.name, 'sub');
    var webpackConfig;
    var parser;
    var jsIntegrity;
    var handler;
    var scripts;

    function cleanup() {
      fs.unlinkSync(path.join(tmpDir.name, 'index.html'));
      fs.unlinkSync(path.join(subDir, 'bundle.js'));
      fs.rmdirSync(subDir);
      tmpDir.removeCallback();
    }
    webpackConfig = {
      entry: {
        main: path.join(__dirname, './dummy.js')
      },
      output: {
        path: subDir,
        filename: 'bundle.js',
        publicPath: '/',
        crossOriginLoading: 'anonymous'
      },
      plugins: [
        new HtmlWebpackPlugin({
          filename: '../index.html',
          chunks: ['main']
        }),
        new SriPlugin({ hashFuncNames: ['sha256', 'sha384'] })
      ]
    };
    webpack(webpackConfig, function webpackCallback(err, result) {
      if (err) {
        cleanup();
        callback(err);
      }
      expect(result.compilation.warnings).toEqual([]);
      jsIntegrity = result.compilation.assets['bundle.js'].integrity;
      expect(jsIntegrity).toMatch(/^sha/);

      handler = new htmlparser.DefaultHandler(function htmlparserCallback(error, dom) {
        if (error) {
          cleanup();
          callback(error);
        } else {
          scripts = select(dom, 'script');
          expect(scripts.length).toEqual(1);
          expect(scripts[0].attribs.crossorigin).toEqual('anonymous');
          expect(scripts[0].attribs.integrity).toEqual(jsIntegrity);

          cleanup();
          callback();
        }
      });
      parser = new htmlparser.Parser(handler);
      parser.parseComplete(fs.readFileSync(path.join(tmpDir.name, 'index.html'), 'utf-8'));
    });
  });

  (webpack.NamedChunksPlugin ? it : it.skip)('supports dashes in chunk names', function it(callback) {
    var tmpDir = tmp.dirSync();
    var mainJs = path.join(tmpDir.name, 'main.js');
    var chunk1Js = path.join(tmpDir.name, 'chunk1.js');
    var webpackConfig;

    fs.writeFileSync(mainJs, 'import(/* webpackChunkName: "chunk-name-with-dashes" */ "./chunk1.js")');
    fs.writeFileSync(chunk1Js, ';');

    function cleanup(err) {
      fs.unlinkSync(path.join(tmpDir.name, 'main.js'));
      fs.unlinkSync(path.join(tmpDir.name, 'chunk1.js'));
      fs.unlinkSync(path.join(tmpDir.name, 'bundle.js'));
      glob.sync(path.join(tmpDir.name, '*.bundle.js')).forEach(fs.unlinkSync);
      tmpDir.removeCallback();
      callback(err);
    }

    webpackConfig = {
      entry: mainJs,
      output: {
        path: tmpDir.name,
        filename: 'bundle.js',
        crossOriginLoading: 'anonymous'
      },
      plugins: [
        new SriPlugin({ hashFuncNames: ['sha256', 'sha384'] }),
        new webpack.NamedChunksPlugin()
      ]
    };
    webpack(webpackConfig, function webpackCallback(err, result) {
      expect(result.compilation.errors).toEqual([]);
      expect(result.compilation.warnings).toEqual([]);

      // Ensure generated code can be parsed
      // eslint-disable-next-line no-new
      new vm.Script(fs.readFileSync(path.join(tmpDir.name, 'bundle.js')));

      cleanup(err);
    });
  });
});
