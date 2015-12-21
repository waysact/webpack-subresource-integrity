describe('SriPlugin', function describe() {
  it('should add integrity attributes to all script tags loading webpack chunk', function it(callback) {
    require.ensure([], function requireEnsure(require) {
      require('./chunk1')(callback);
    });
  });
});
