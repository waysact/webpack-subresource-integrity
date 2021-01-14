const { SubresourceIntegrityPlugin } = require("webpack-subresource-integrity");
const expect = require("expect");

module.exports = {
  entry: {
    index: "./index.js",
  },
  output: {
    crossOriginLoading: "anonymous",
  },
  plugins: [
    new SubresourceIntegrityPlugin({
      hashFuncNames: ["sha256"],
      enabled: true,
    }),
    {
      apply: (compiler) => {
        compiler.hooks.done.tap("wsi-test", (stats) => {
          expect(
            !stats.toJson().assets.find((asset) => asset.name == "index.js")
              .integrity
          ).not.toBeNull();
        });
      },
    },
  ],
};
