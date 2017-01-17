var SriPlugin = require('./index');
var karmaMiddleware = require('karma/lib/middleware/karma');

var toplevelScriptIntegrity;
var stylesheetIntegrity;

/*
 *  Simple webpack plugin that records the top-level chunk's integrity
 *  attribute value.
 */
function GetIntegrityPlugin() {}
GetIntegrityPlugin.prototype.apply = function apply(compiler) {
  compiler.plugin('done', function donePlugin(stats) {
    var asset;
    asset = stats.compilation.assets['test/test.js'];
    if (asset) {
      toplevelScriptIntegrity = asset.integrity;
    }
    asset = stats.compilation.assets['stylesheet.css'];
    if (asset) {
      stylesheetIntegrity = asset.integrity;
    }
  });
};

/*
 *  Hack Karma to add the integrity attribute to the script tag
 *  loading the top-level chunk.
 */
var prevCreate = karmaMiddleware.create;
function nextCreate(filesPromise, serveStaticFile, serveFile, injector, basePath, urlRoot, upstreamProxy) {
  var prevMiddleware = prevCreate(filesPromise, serveStaticFile, serveFile, injector, basePath, urlRoot, upstreamProxy);
  return function nextMiddleware(request, response, next) {
    var requestUrl = request.normalizedUrl.replace(/\?.*/, '');
    requestUrl = requestUrl.substr(urlRoot.length - 1);
    if (requestUrl === '/context.html' &&
        toplevelScriptIntegrity &&
        toplevelScriptIntegrity.startsWith('sha') &&
        stylesheetIntegrity &&
        stylesheetIntegrity.startsWith('sha')) {
      var prevWrite = response.write;
      response.write = function nextWrite(chunk, encoding) {
        var nextChunk = chunk.replace(
          'src="/base/test/test.js',
          'integrity="' + toplevelScriptIntegrity + '" crossorigin="anonymous" src="/base/test/test.js');
        nextChunk = nextChunk.replace(
          'rel="stylesheet"',
          'rel="stylesheet" integrity="' + stylesheetIntegrity + '" crossorigin="anonymous"'
        );
        prevWrite.call(response, nextChunk, encoding);
      };
    }
    return prevMiddleware(request, response, next);
  };
}
nextCreate.$inject = prevCreate.$inject;
karmaMiddleware.create = nextCreate;

/*
 *  Karma configuration
 */
module.exports = function karmaConfig(config) {
  config.set({
    browsers: [
      'Chrome',
      'Firefox'
    ],
    frameworks: [
      'mocha'
    ],
    files: [
      'test/test.js',
      'test/stylesheet.css'
    ],
    preprocessors: {
      'test/test.js': ['webpack']
    },
    plugins: [
      'karma-webpack',
      'karma-chrome-launcher',
      'karma-firefox-launcher',
      'karma-mocha'
    ],
    webpack: {
      entry: 'main',
      output: {
        crossOriginLoading: 'anonymous'
      },
      plugins: [
        new SriPlugin({
          hashFuncNames: ['sha256', 'sha384']
        }),
        new GetIntegrityPlugin()
      ],
      module: {
        loaders: [{
          test: /\.css$/,
          loader: 'file-loader?name=stylesheet.css'
        }]
      },

      devtool: 'source-map' // to force multiple files per chunk
    }
  });
};
