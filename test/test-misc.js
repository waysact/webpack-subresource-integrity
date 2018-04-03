/**
 * Copyright (c) 2015-present, Waysact Pty Ltd
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

var webpack = require('webpack');
var path = require('path');
var SriPlugin = require('../index');
var fs = require('fs');
var expect = require('expect');
var tmp = require('tmp');
var crypto = require('crypto');
var Promise = require('bluebird');
var webpackVersion = Number(
  require('webpack/package.json').version.split('.')[0]
);

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

describe('Edge Cases', function describe() {
  it('should error when code splitting is used with crossOriginLoading', function it() {
    var tmpDir = tmp.dirSync();
    var mainJs = path.join(tmpDir.name, 'main.js');
    var chunkJs = path.join(tmpDir.name, 'chunk.js');

    return new Promise((resolve, reject) => {
      var webpackConfig;

      fs.writeFileSync(
        mainJs,
        'require.ensure(["./chunk.js"], function(require) { require("./chunk.js"); });'
      );
      fs.writeFileSync(chunkJs, '');
      webpackConfig = Object.assign({
        entry: mainJs,
        output: {
          path: tmpDir.name,
          filename: 'bundle.js'
        },
        plugins: [
          new SriPlugin({ hashFuncNames: ['sha256', 'sha384'] })
        ]
      }, webpackVersion >= 4 ? {
        mode: 'production'
      } : {});
      webpack(webpackConfig, function webpackCallback(err, result) {
        if (err) {
          reject(err);
          return;
        }
        try {
          expect(result.compilation.warnings.length).toEqual(1);
          expect(result.compilation.warnings[0]).toBeInstanceOf(Error);
          expect(result.compilation.warnings[0].message).toMatch(
              /Set webpack option output.crossOriginLoading/);
          expect(result.compilation.errors.length).toEqual(1);
          expect(result.compilation.errors[0]).toBeInstanceOf(Error);
          expect(result.compilation.errors[0].message).toMatch(
              /webpack option output.crossOriginLoading not set, code splitting will not work!/);
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    }).finally(() => {
      fs.unlinkSync(mainJs);
      fs.unlinkSync(chunkJs);
      if (fs.existsSync(path.join(tmpDir.name, 'bundle.js'))) {
        fs.unlinkSync(path.join(tmpDir.name, 'bundle.js'));
        try {
          fs.unlinkSync(path.join(tmpDir.name, '0.bundle.js'));
        } catch (e) {
          fs.unlinkSync(path.join(tmpDir.name, '1.bundle.js'));
        }
      }
      tmpDir.removeCallback();
    });
  });

  it('should support multiple compilation', function it() {
    var tmpDir = tmp.dirSync();
    var mainJs = path.join(tmpDir.name, 'main.js');
    var otherJs = path.join(tmpDir.name, 'other.js');
    var oldOtherJsSource = 'console.log(123)';
    var newOtherJsSource = 'console.log(456)';
    var watching;
    var callbackCount = 0;
    var webpackConfig;
    var compiler;

    fs.writeFileSync(
      mainJs,
      'require.ensure(["./other.js"], function(require) { require("./other.js"); });'
    );
    fs.writeFileSync(otherJs, oldOtherJsSource);

    return new Promise((resolve, reject) => {
      webpackConfig = Object.assign({
        entry: {
          bundle: mainJs
        },
        output: {
          path: tmpDir.name,
          filename: 'bundle.js',
          chunkFilename: 'chunk.js',
          crossOriginLoading: 'anonymous'
        },
        plugins: [new SriPlugin({ hashFuncNames: ['sha256', 'sha384'] })]
      }, webpackVersion >= 4 ? { mode: 'development' } : {});
      compiler = webpack(webpackConfig);
      function handler(error, stats) {
        var chunkContents;
        var bundleContents;
        var hash;
        var regex;
        var match;
        if (error) {
          reject(error);
          return;
        }

        if (stats.hasErrors()) {
          reject(new Error(stats.toString({ reason: true })));
          return;
        }

        try {
          if (callbackCount === 0) {
            setTimeout(function updateCode() {
              fs.writeFileSync(otherJs, newOtherJsSource);
            }, 1000); // FIXME -- brittle and slow
            callbackCount += 1;
          } else if (callbackCount === 1) {
            chunkContents = fs.readFileSync(
              path.join(tmpDir.name, 'chunk.js'),
              'utf-8'
            );
            bundleContents = fs.readFileSync(
              path.join(tmpDir.name, 'bundle.js'),
              'utf-8'
            );

            if (chunkContents.indexOf(newOtherJsSource) >= 0) {
              callbackCount += 1;
              watching.close(function afterClose() {
                try {
                  expect(bundleContents).toMatch(/\.integrity\s*=/);
                  hash = crypto
                    .createHash('sha256')
                    .update(chunkContents, 'utf8')
                    .digest('base64');
                  regex = /sha256-([^ ]+)/g;
                  match = regex.exec(bundleContents);
                  expect(match).not.toBeNull();
                  expect(match[1]).toEqual(hash);
                  expect(regex.exec(bundleContents)).toBeFalsy();
                  resolve();
                } catch (err) {
                  reject(err);
                }
              });
            }
          }
        } catch (e) {
          reject(e);
        }
      }
      watching = compiler.watch({ aggregateTimeout: 0 }, handler);
    }).finally(() => {
      compiler.purgeInputFileSystem();
      fs.unlinkSync(path.join(tmpDir.name, 'chunk.js'));
      fs.unlinkSync(path.join(tmpDir.name, 'bundle.js'));
      fs.unlinkSync(path.join(tmpDir.name, 'main.js'));
      fs.unlinkSync(path.join(tmpDir.name, 'other.js'));
      tmpDir.removeCallback();
    });
  });
});

describe('Plugin Options', function describe() {
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
    expect(dummyCompilation.errors[0]).toBeInstanceOf(Error);
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
    expect(dummyCompilation.warnings[0]).toBeInstanceOf(Error);
    expect(dummyCompilation.warnings[0].message).toMatch(new RegExp(
      'It is recommended that at least one hash function is part of ' +
        'the set for which support is mandated by the specification'));
  });

  it('warns when jsonFile is not a valid filename', function it() {
    expect(function block() {
      new SriPlugin({ jsonFile: 'integrity.js' }); // eslint-disable-line no-new
    }).toThrow(/jsonFile must specify a \.json filename/);
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
        /Set webpack option output.crossOriginLoading/);
  });
});
