const { SubresourceIntegrityPlugin } = require("webpack-subresource-integrity");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { readFileSync } = require("fs");
const { join } = require("path");
const expect = require("expect");

module.exports = {
  entry: {
    index: "./index.js",
  },
  output: {
    crossOriginLoading: "anonymous",
  },
  devtool: "source-map",
  plugins: [
    new SubresourceIntegrityPlugin({
      hashFuncNames: ["sha256", "sha384"],
      enabled: true,
    }),
    new HtmlWebpackPlugin(),
    {
      apply: (compiler) => {
        compiler.hooks.done.tap("wsi-test", (stats) => {
          if (stats && stats.hasErrors()) {
            throw new Error(
              stats
                .toJson()
                .errors.map((error) => error.message)
                .join(", ")
            );
          }
          const findAndStripSriHashString = (filePath, pattern, offset) => {
            const fileContent = readFileSync(
              join(__dirname, filePath),
              "utf-8"
            );
            return (string = fileContent
              .substring(fileContent.indexOf(pattern) + (offset || 0))
              .match(/\{(.*?)\}/)[0]
              .replace(/\\/g, "")
              .replace(/\"/g, ""));
          };

          const sriHashesInSource = findAndStripSriHashString(
            "dist/index.js",
            "sha256-",
            -10
          );
          const sriHashesInMap = findAndStripSriHashString(
            "dist/index.js.map",
            "__webpack_require__.sriHashes = "
          );
          expect(sriHashesInSource.length).toEqual(sriHashesInMap.length);
        });
      },
    },
  ],
};
