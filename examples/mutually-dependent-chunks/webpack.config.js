const { SubresourceIntegrityPlugin } = require("webpack-subresource-integrity");
const expect = require("expect");

module.exports = {
  entry: "./main.js",
  output: {
    filename: "bundle.js",
    crossOriginLoading: "anonymous",
  },
  plugins: [
    new SubresourceIntegrityPlugin({ hashFuncNames: ["sha256", "sha384"] }),
    {
      apply: (compiler) => {
        compiler.hooks.done.tap("wsi-test", (stats) => {
          expect(stats.hasWarnings()).toBeFalsy();
          stats.toJson().assets.forEach((asset) => {
            expect(asset.integrity).toMatch(/^sha/);
          });
        });
      },
    },
  ],
};
