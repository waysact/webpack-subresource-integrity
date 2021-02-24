const { SubresourceIntegrityPlugin } = require("webpack-subresource-integrity");
const expect = require("expect");

module.exports = {
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
  plugins: [
    new SubresourceIntegrityPlugin({
      hashFuncNames: ["sha256"],
      enabled: true,
    }),
    {
      apply: (compiler) => {
        compiler.hooks.done.tap("wsi-test", (stats) => {
          expect(Object.keys(stats.compilation.assets)).toContain(
            "f144a6b271b5e4f2b145.js"
          );
        });
      },
    },
  ],
};
