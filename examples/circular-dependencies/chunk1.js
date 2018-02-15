module.exports = function chunk1(callback) {
  require.ensure([], function requireEnsure(require) {
    require('./chunk2')(callback);
  });
};
