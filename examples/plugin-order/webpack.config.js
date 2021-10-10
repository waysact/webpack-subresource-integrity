const { SubresourceIntegrityPlugin } = require("webpack-subresource-integrity");
const expect = require("expect");
const fs = require("fs");
const path = require("path");

module.exports = {
  entry: {
    index: "./index.js",
    'index-orig': "./index-orig.js",
  },
  output: {
    crossOriginLoading: "anonymous",
  },
  plugins: [
    new SubresourceIntegrityPlugin({
      hashFuncNames: ["sha256"],
      enabled: true,
    }),
    // This plugin taps into the same `processAssets` stage as WSI,
    // and runs after it. It will modify the `index-orig.js` asset
    // after WSI has calculated its integrity hash, thus producing
    // an erro scenario. This test asserts that the hash calculation
    // will be incorect.
    {
      apply: (compiler) => {
        compiler.hooks.thisCompilation.tap(
          { name: 'edit index.js' },
          (compilation) => {
            compilation.hooks.processAssets.tap(
              {
                name: 'edit index.js',
                stage: compilation.compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE,
              },
              (records) => {
                compilation.updateAsset(
                  'index.js',
                  new compiler.webpack.sources.RawSource('console.log("not ok");', false)
                );
              }
            );
          }
        );
      }
    },
    {
      apply: (compiler) => {
        compiler.hooks.done.tap("wsi-test", (stats) => {
          const origSourceContent = fs.readFileSync(path.join(__dirname, './index-orig.js')).toString()
          const sourceContent = fs.readFileSync(path.join(__dirname, './index.js')).toString()

          // Source files are identical
          expect(origSourceContent).toEqual(sourceContent);

          const { assets } = stats.toJson()

          const origIntegrity = assets.find((asset) => asset.name == "index-orig.js").integrity
          const integrity = assets.find((asset) => asset.name == "index.js").integrity
          
          // Integrity is the same between `index.js` and `index-orig.js`
          expect(integrity).toEqual(origIntegrity);

          const origDistContent = fs.readFileSync(path.join(__dirname, './dist/index-orig.js')).toString()
          const distContent = fs.readFileSync(path.join(__dirname, './dist/index.js')).toString()
          
          // But their contents are not!
          expect(origDistContent).not.toEqual(distContent);
        });
      },
    },
  ],
};
