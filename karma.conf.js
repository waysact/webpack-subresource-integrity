var SriPlugin = require('./index');
var karmaMiddleware = require('karma/lib/middleware/karma');

var toplevelIntegrity;

/*
 *  Simple webpack plugin that records the top-level chunk's integrity
 *  attribute value.
 */
function GetIntegrityPlugin() {}
GetIntegrityPlugin.prototype.apply = function apply(compiler) {
  compiler.plugin('done', function donePlugin(stats) {
    var asset = stats.compilation.assets['test/test.js'];
    if (asset) {
      toplevelIntegrity = asset.integrity;
    }
  });
};

/*
 *  Hack Karma to add the integrity attribute to the script tag
 *  loading the top-level chunk.
 */
var prevCreate = karmaMiddleware.create;
function nextCreate(filesPromise, serveStaticFile, basePath, urlRoot, client) {
  var prevMiddleware = prevCreate(filesPromise, serveStaticFile, basePath, urlRoot, client);
  return function nextMiddleware(request, response, next) {
    var requestUrl = request.normalizedUrl.replace(/\?.*/, '');
    requestUrl = requestUrl.substr(urlRoot.length - 1);
    if (requestUrl === '/context.html') {
      var prevWrite = response.write;
      response.write = function nextWrite(chunk, encoding) {
        var nextChunk = chunk.replace(
          'src="/base/test/test.js',
          'integrity="' + toplevelIntegrity + '" src="/base/test/test.js');
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
      'test/test.js'
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
      plugins: [
        new SriPlugin(['sha256', 'sha384']),
        new GetIntegrityPlugin()
      ],
      devtool: 'source-map' // to force multiple files per chunk
    }
  });
};
