var expect = require('expect');

module.exports = function chunk2(callback) {
  var resourcesWithIntegrity;
  function forEachElement(el) {
    var src = el.getAttribute('src') || el.getAttribute('href');
    var integrity = el.getAttribute('integrity');
    var crossorigin = el.getAttribute('crossOrigin');
    var match;
    if (src) {
      match = src.match(/[^/]+\.(js|css)/);
      if (match && crossorigin && integrity && integrity.match(/^sha\d+-/)) {
        resourcesWithIntegrity.push(match[0].toString());
      }
    }
  }
  try {
    resourcesWithIntegrity = [];
    Array.prototype.slice
      .call(document.getElementsByTagName('script'))
      .forEach(forEachElement);
    Array.prototype.slice
      .call(document.getElementsByTagName('link'))
      .forEach(forEachElement);
    expect(resourcesWithIntegrity).toInclude('stylesheet.css');
    expect(resourcesWithIntegrity).toInclude('test.js');
    expect(
      resourcesWithIntegrity.filter(function filter(item) {
        return item.match(/^\d+\.(chunk|bundle).js$/);
      }).length
    ).toBe(2);
    expect(
      window.getComputedStyle(document.getElementsByTagName('body')[0])
        .backgroundColor
    ).toEqual('rgb(200, 201, 202)');
    callback();
  } catch (e) {
    callback(e);
  }
};
