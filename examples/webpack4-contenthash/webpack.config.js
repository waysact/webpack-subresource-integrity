var SriPlugin = require("webpack-subresource-integrity");
var HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  entry: "./index.js",
  mode: "production",
  output: {
    filename: "[name].[contenthash].js",
    chunkFilename: "[name].[contenthash].js",
    crossOriginLoading: "anonymous"
  },
  plugins: [
    new HtmlWebpackPlugin(),
    new SriPlugin({
      hashFuncNames: ["sha256", "sha384"]
    })
  ]
};
