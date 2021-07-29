const { SubresourceIntegrityPlugin } = require("webpack-subresource-integrity");

module.exports = {
  entry: "./index.js",
  output: {
    filename: "[chunkhash].js",
    chunkFilename: "[chunkhash].chunk.js",
    crossOriginLoading: "anonymous",
  },
  optimization: {
    moduleIds: "deterministic",
    splitChunks: {
      chunks: "all",
      minSize: 1,
    },
  },
  plugins: [
    new SubresourceIntegrityPlugin({
      hashFuncNames: ["sha256"],
      enabled: true,
    }),
  ],
};
