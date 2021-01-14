const { SubresourceIntegrityPlugin } = require("webpack-subresource-integrity");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const expect = require("expect");

module.exports = {
  entry: {
    index: "./index.js",
  },
  target: "node",
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
        compiler.hooks.done.tap("wsi-test", (stats) => {
          expect(stats.compilation.errors).toEqual([]);
          expect(stats.compilation.warnings.length).toEqual(1);
          expect(stats.compilation.warnings[0].message).toMatch(
            /This plugin is not useful for non-web targets/
          );
        });
      },
    },
  ],
};
