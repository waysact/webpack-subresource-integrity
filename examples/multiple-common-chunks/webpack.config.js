const { SubresourceIntegrityPlugin } = require("webpack-subresource-integrity");
const webpack = require("webpack");
const { readFileSync } = require("fs");
const { join } = require("path");
const expect = require("expect");

module.exports = {
  entry: {
    pageA: "./pageA.js",
    pageB: "./pageB.js",
  },
  output: {
    filename: "[name].js",
    crossOriginLoading: "anonymous",
  },
  plugins: [
    new SubresourceIntegrityPlugin({ hashFuncNames: ["sha256", "sha384"] }),
    {
      apply: (compiler) => {
        compiler.hooks.done.tap("wsi-test", (stats) => {
          expect(stats.hasWarnings()).toBeFalsy();
          ["commons1.js", "commons2.js"].forEach((filename) => {
            expect(readFileSync(join("dist", filename), "utf-8")).not.toContain(
              "CHUNK-SRI-HASH"
            );
          });
        });
      },
    },
  ],
  optimization: {
    splitChunks: {
      cacheGroups: {
        commons1: {
          test: /pageA/,
          chunks: "initial",
          name: "commons1",
          enforce: true,
        },
        commons2: {
          test: /pageB/,
          chunks: "initial",
          name: "commons2",
          enforce: true,
        },
      },
    },
  },
};
