var expect = require('expect');

module.exports = function chunk2(callback) {
  var resourcesWithIntegrity = [];
  function forEachElement(el) {
    var src = el.getAttribute('src') || el.getAttribute('href');
    var integrity = el.getAttribute('integrity');
    if (src) {
      var match = src.match(/[^\/]+\.(js|css)/);
      if (match && integrity && integrity.match(/^sha\d+-/)) {
        resourcesWithIntegrity.push(match[0].toString());
      }
    }
  }
  Array.prototype.slice.call(document.getElementsByTagName('script')).forEach(forEachElement);
  Array.prototype.slice.call(document.getElementsByTagName('link')).forEach(forEachElement);
  resourcesWithIntegrity.sort();
  expect(resourcesWithIntegrity).toEqual(['1.chunk.js', '2.chunk.js', 'stylesheet.css', 'test.js']);
  expect(window.getComputedStyle(document.getElementsByTagName('body')[0]).backgroundColor).toEqual('rgb(200, 201, 202)');
  callback();
};
