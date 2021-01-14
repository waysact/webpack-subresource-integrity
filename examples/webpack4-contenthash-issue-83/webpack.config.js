const { SubresourceIntegrityPlugin } = require("webpack-subresource-integrity");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const expect = require("expect");

module.exports = {
  mode: "production",
  entry: "./index.js",
  output: {
    crossOriginLoading: "anonymous",
    chunkFilename: "[name]-[chunkhash].js",
    filename: "[name]-[contenthash].js",
  },
  optimization: {
    splitChunks: {
      cacheGroups: {
        styles: {
          name: "style",
          chunks: "all",
          enforce: true,
        },
      },
    },
  },
  plugins: [
    new MiniCssExtractPlugin({ filename: "[name].css" }),
    new SubresourceIntegrityPlugin({
      hashFuncNames: ["sha256", "sha384"],
    }),
    {
      apply: (compiler) => {
        compiler.hooks.done.tap("wsi-test", (stats) => {
          expect(stats.compilation.warnings).toEqual([]);
        });
      },
    },
  ],
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
};
