const { SubresourceIntegrityPlugin } = require("webpack-subresource-integrity");
const webpack = require("webpack");
const expect = require("expect");

module.exports = {
  entry: "./index.js",
  output: {
    filename: "bundle.js",
    crossOriginLoading: "anonymous",
  },
  plugins: [
    new webpack.HotModuleReplacementPlugin(),
    new SubresourceIntegrityPlugin({ hashFuncNames: ["sha256", "sha384"] }),
    {
      apply: (compiler) => {
        compiler.hooks.done.tap("wsi-test", (stats) => {
          expect(stats.compilation.warnings.length).toEqual(1);
          expect(stats.compilation.warnings[0]).toBeInstanceOf(Error);
          expect(stats.compilation.warnings[0].message).toMatch(
            /may interfere with hot reloading./
          );
        });
      },
    },
  ],
};
