const { SubresourceIntegrityPlugin } = require("webpack-subresource-integrity");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const expect = require("expect");
const htmlparser2 = require("htmlparser2");
const { readFileSync } = require("fs");
const { selectAll } = require("css-select");

module.exports = {
  mode: "production",
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

          const dom = htmlparser2.parseDocument(
            readFileSync("./dist/index.html", "utf-8")
          );

          const scripts = selectAll("script", dom);
          expect(scripts.length).toEqual(1);
          expect(scripts[0].attribs.crossorigin).toEqual("anonymous");
          expect(scripts[0].attribs.integrity).toEqual(jsIntegrity);
        });
      },
    },
  ],
};
