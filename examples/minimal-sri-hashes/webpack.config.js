const { SubresourceIntegrityPlugin } = require("webpack-subresource-integrity");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { readFileSync } = require("fs");
const { join } = require("path");
const expect = require("expect");

module.exports = {
  mode: "development",
  entry: {
    mainAppChunk: ["./index.js"],
  },
  output: {
    filename: "[name].js",
    publicPath: "/",
    crossOriginLoading: "anonymous",
  },
  optimization: {
    runtimeChunk: "single",
    splitChunks: {
      chunks: "all",
      cacheGroups: {
        vendors: {
          test: /node_modules/,
          name: "vendors",
          chunks: "all",
        },
      },
    },
  },
  plugins: [
    new HtmlWebpackPlugin(),
    new SubresourceIntegrityPlugin({ hashFuncNames: ["sha256", "sha384"] }),
    {
      apply: (compiler) => {
        compiler.hooks.done.tap("wsi-test", (stats) => {
          const runtimeJs = readFileSync(
            join(__dirname, "dist/runtime.js"),
            "utf-8"
          );
          expect(runtimeJs).not.toMatch(/mainAppChunk/);
        });
      },
    },
  ],
};
