const { SubresourceIntegrityPlugin } = require("webpack-subresource-integrity");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { RunInPuppeteerPlugin } = require("wsi-test-helper");

module.exports = {
  entry: "./index.js",
  mode: "production",
  output: {
    filename: "[name].[contenthash].js",
    chunkFilename: "[name].[contenthash].js",
    crossOriginLoading: "anonymous",
  },
  plugins: [
    new HtmlWebpackPlugin(),
    new SubresourceIntegrityPlugin({
      hashFuncNames: ["sha256", "sha384"],
    }),
    new RunInPuppeteerPlugin(),
  ],
};
