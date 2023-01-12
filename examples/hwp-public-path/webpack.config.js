const { SubresourceIntegrityPlugin } = require("webpack-subresource-integrity");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const expect = require("expect");
const htmlparser = require("htmlparser");
const { readFileSync } = require("fs");
const { select } = require("soupselect");

module.exports = {
  entry: "./index.js",
  output: {
    filename: "bundle.js",
    publicPath: "/",
    crossOriginLoading: "anonymous",
  },
  plugins: [
    new HtmlWebpackPlugin(),
    new SubresourceIntegrityPlugin({ hashFuncNames: ["sha256", "sha384"] }),
    {
      apply: (compiler) => {
        compiler.hooks.done.tapPromise("wsi-test", async (stats) => {
          expect(stats.compilation.warnings).toEqual([]);
          const jsIntegrity =
            stats.toJson().assets.find((asset) => asset.name === "bundle.js")
              .integrity || stats.compilation.assets["bundle.js"].integrity;
          expect(jsIntegrity).toMatch(/^sha/);

          return new Promise((resolve, reject) => {
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
              readFileSync("./dist/index.html", "utf-8")
            );
          });
        });
      },
    },
  ],
};
