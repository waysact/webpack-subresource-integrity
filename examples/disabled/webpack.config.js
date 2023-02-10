const { SubresourceIntegrityPlugin } = require("webpack-subresource-integrity");
const expect = require("expect");

module.exports = {
  mode: "production",
  entry: "./index.js",
  output: {
    filename: "bundle.js",
  },
  plugins: [
    new SubresourceIntegrityPlugin({
      hashFuncNames: ["sha256"],
      enabled: false,
    }),
    {
      apply: (compiler) => {
        compiler.hooks.done.tapPromise("wsi-test", async (stats) => {
          expect(stats.compilation.warnings).toEqual([]);
          expect(
            Object.keys(
              stats.toJson().assets.find((asset) => asset.name === "bundle.js")
            )
          ).not.toContain("integrity");
        });
      },
    },
  ],
};
