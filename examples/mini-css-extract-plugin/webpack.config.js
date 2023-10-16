const { SubresourceIntegrityPlugin } = require("webpack-subresource-integrity");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const { RunInPuppeteerPlugin } = require("wsi-test-helper");
const expect = require("expect");
const fs = require("fs");
const path = require("path");

module.exports = {
  mode: "none",
  entry: {
    index: "./index.js",
  },
  plugins: [
    new MiniCssExtractPlugin({
      // Options similar to the same options in webpackOptions.output
      // both options are optional
      filename: "[name].css",
      chunkFilename: "[name].css",
    }),
    new SubresourceIntegrityPlugin({
      hashFuncNames: ["sha256", "sha384"],
      enabled: true,
    }),
    new HtmlWebpackPlugin(),
    new RunInPuppeteerPlugin(),
    {
      apply: (compiler) => {
        compiler.hooks.done.tap("wsi-test", (stats) => {
          expect(stats.compilation.warnings).toEqual([]);
          expect(stats.compilation.errors).toEqual([]);
          const cssIntegrity = stats
            .toJson()
            .assets.find((asset) => asset.name === "style.css").integrity;
          const source = fs.readFileSync(
            path.join(__dirname, "./dist/runtime.js"),
            "utf-8"
          );
          const sriManifest = JSON.parse(
            source.match(/__webpack_require__.sriHashes = ({.+});/)?.[1] || "{}"
          );
          expect(sriManifest["style_css/mini-extract"]).toEqual(cssIntegrity);
        });
      },
    },
  ],
  output: {
    crossOriginLoading: "anonymous",
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: "css-loader",
            options: {
              sourceMap: true,
              modules: {
                auto: true,
              },
              importLoaders: 1,
            },
          },
        ],
      },
    ],
  },
  optimization: {
    chunkIds: "named",
    runtimeChunk: {
      name: "runtime",
    },
  },
};
