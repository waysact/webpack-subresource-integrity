const { SubresourceIntegrityPlugin } = require("webpack-subresource-integrity");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { RunInPuppeteerPlugin } = require("wsi-test-helper");
const { writeFileSync } = require("fs");

let gotError = false;

module.exports = {
  entry: {
    index: "./index.js",
  },
  output: {
    crossOriginLoading: "anonymous",
  },
  plugins: [
    new SubresourceIntegrityPlugin({
      hashFuncNames: ["sha256", "sha384"],
      lazyHashes: true,
    }),
    new HtmlWebpackPlugin(),
    new RunInPuppeteerPlugin({
      onStart: (stats) => {
        console.log(stats.compilation.assets);
        writeFileSync("dist/corrupt.js", 'console.log("corrupted");');
      },
      onConsoleError: (msg) => {
        console.log(msg);
        if (
          msg.match(
            /Failed to find a valid digest in the 'integrity' attribute for resource/
          )
        ) {
          gotError = true;
        }
      },
      onDone: () => {
        if (!gotError) {
          throw new Error("No error was raised");
        }
      },
    }),
  ],
};
