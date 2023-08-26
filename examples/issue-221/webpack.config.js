const { SubresourceIntegrityPlugin } = require("webpack-subresource-integrity");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const expect = require("expect");

module.exports = {
  entry: {
    "why 1+1=2?": "./index.js",
  },
  output: {
    crossOriginLoading: "anonymous",
  },
  plugins: [
    new SubresourceIntegrityPlugin({
      hashFuncNames: ["sha256"],
      enabled: true,
    }),
    new HtmlWebpackPlugin(),
    {
      apply: (compiler) => {
        compiler.hooks.done.tap("wsi-test", (stats) => {
          expect(
            stats.toJson().assets.find((asset) => asset.name == "why 1+1=2?.js")
          ).toHaveProperty("integrity");
        });
      },
    },
  ],
};
