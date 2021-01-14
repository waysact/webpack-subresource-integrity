const { SubresourceIntegrityPlugin } = require("webpack-subresource-integrity");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const expect = require("expect");
const htmlparser = require("htmlparser");
const { readFileSync } = require("fs");
const { select } = require("soupselect");

module.exports = {
  entry: "./index.js",
  output: {
    filename: "subdir/bundle.js",
    crossOriginLoading: "anonymous",
  },
  plugins: [
    new HtmlWebpackPlugin({
      hash: true,
      filename: "assets/admin.html",
    }),
    new SubresourceIntegrityPlugin({ hashFuncNames: ["sha256", "sha384"] }),
    {
      apply: (compiler) => {
        compiler.hooks.done.tapPromise("wsi-test", async (stats) => {
          const jsIntegrity =
            stats
              .toJson()
              .assets.find((asset) => asset.name === "subdir/bundle.js")
              .integrity ||
            stats.compilation.assets["subdir/bundle.js"].integrity;
          expect(jsIntegrity).toMatch(/^sha/);

          await new Promise((resolve, reject) => {
            const handler = new htmlparser.DefaultHandler((error, dom) => {
              if (error) {
                reject(error);
                return;
              }

              const scripts = select(dom, "script");
              expect(scripts.length).toEqual(1);
              expect(scripts[0].attribs.crossorigin).toEqual("anonymous");
              expect(scripts[0].attribs.integrity).toEqual(jsIntegrity);
              resolve();
            });
            new htmlparser.Parser(handler).parseComplete(
              readFileSync("./dist/assets/admin.html", "utf-8")
            );
          });
        });
      },
    },
  ],
};
