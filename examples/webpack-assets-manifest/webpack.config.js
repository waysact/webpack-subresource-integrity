const { SubresourceIntegrityPlugin } = require("webpack-subresource-integrity");
const WebpackAssetsManifest = require("webpack-assets-manifest");
const expect = require("expect");
const { readFileSync } = require("fs");
const { join } = require("path");

module.exports = {
  entry: {
    index: "./index.js",
  },
  output: {
    crossOriginLoading: "anonymous",
  },
  plugins: [
    new SubresourceIntegrityPlugin({
      hashFuncNames: ["sha384", "sha512"],
      enabled: true,
    }),
    new WebpackAssetsManifest({ integrity: true }),
    {
      apply: (compiler) => {
        compiler.hooks.done.tap("wsi-test", (stats) => {
          const manifest = JSON.parse(
            readFileSync(join(__dirname, "dist/manifest.json"), "utf-8")
          );
          expect(manifest["index.js"].integrity).toMatch(/sha384-.* sha512-.*/);
        });
      },
    },
  ],
};
