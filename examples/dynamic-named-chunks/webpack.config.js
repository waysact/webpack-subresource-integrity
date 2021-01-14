const { SubresourceIntegrityPlugin } = require("webpack-subresource-integrity");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { RunInPuppeteerPlugin } = require("wsi-test-helper");

module.exports = {
  entry: {
    index: "./index.js",
  },
  output: {
    crossOriginLoading: "anonymous",
  },
  optimization: {
    chunkIds: "named",
  },
  plugins: [
    new SubresourceIntegrityPlugin({
      hashFuncNames: ["sha256", "sha384"],
    }),
    new HtmlWebpackPlugin(),
    new RunInPuppeteerPlugin(),
  ],
};
