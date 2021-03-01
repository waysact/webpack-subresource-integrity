const HtmlWebpackPlugin = require("html-webpack-plugin");
const { SubresourceIntegrityPlugin } = require("webpack-subresource-integrity");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const expect = require("expect");
const { RunInPuppeteerPlugin } = require("wsi-test-helper");

module.exports = {
  // mode: "development",
  devtool: "cheap-module-source-map",
  entry: "./index.js",
  output: {
    filename: "[contenthash].js",
    chunkFilename: "[contenthash].chunk.js",
    crossOriginLoading: "anonymous",
  },
  optimization: {
    moduleIds: "deterministic",
    realContentHash: true,
    chunkIds: "deterministic",
    runtimeChunk: "single",
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: `[contenthash].css`,
      chunkFilename: `[contenthash].chunk.css`,
    }),
    new SubresourceIntegrityPlugin({ enabled: true }),
    new HtmlWebpackPlugin(),
    {
      apply: (compiler) => {
        compiler.hooks.done.tap("wsi-test", (stats) => {
          const cssAsset = stats
            .toJson()
            .assets.find((asset) => asset.name.match(/\.css$/));

          expect(cssAsset.info.contenthash).toBeDefined();
          expect(
            cssAsset.info.contenthash.find((hash) => hash.match(/^sha/))
          ).toBeDefined();
          expect(cssAsset.integrity).toBeDefined();
        });
      },
    },
    new RunInPuppeteerPlugin(),
  ],
};
