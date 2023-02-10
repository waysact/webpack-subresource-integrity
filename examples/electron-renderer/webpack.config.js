const { SubresourceIntegrityPlugin } = require("webpack-subresource-integrity");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const expect = require("expect");

module.exports = {
  mode: "production",
  entry: {
    index: "./index.js",
  },
  target: "electron-renderer",
  output: {
    crossOriginLoading: "anonymous",
  },
  plugins: [
    new SubresourceIntegrityPlugin({
      hashFuncNames: ["sha256", "sha384"],
      enabled: true,
    }),
    new HtmlWebpackPlugin(),
    {
      apply: (compiler) => {
        compiler.hooks.done.tapPromise("wsi-test", async (stats) => {
          expect(stats.compilation.warnings).toEqual([]);
          expect(stats.compilation.errors).toEqual([]);
        });
      },
    },
  ],
};
