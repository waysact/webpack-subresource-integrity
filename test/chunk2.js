var expect = require('expect');

module.exports = function chunk2(callback) {
  var scriptsWithIntegrity = [];
  Array.prototype.slice.call(document.getElementsByTagName('script')).forEach(
    function forEachScript(scriptTag) {
      var src = scriptTag.getAttribute('src');
      var integrity = scriptTag.getAttribute('integrity');
      if (src) {
        var match = src.match(/[^\/]+\.js/);
        if (match && integrity) {
          scriptsWithIntegrity.push(match[0].toString());
        }
      }
    }
  );
  scriptsWithIntegrity.sort();
  expect(scriptsWithIntegrity).toEqual(['1.chunk.js', '2.chunk.js', 'test.js']);
  callback();
};
