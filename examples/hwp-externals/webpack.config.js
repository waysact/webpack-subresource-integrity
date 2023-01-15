const { SubresourceIntegrityPlugin } = require("webpack-subresource-integrity");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const HtmlWebpackExternalsPlugin = require("html-webpack-externals-plugin");
const expect = require("expect");
const htmlparser2 = require("htmlparser2");
const { readFileSync } = require("fs");
const { selectAll } = require("css-select");

module.exports = {
  entry: "./index.js",
  output: {
    filename: "bundle.js",
    publicPath: "/",
    crossOriginLoading: "anonymous",
  },
  plugins: [
    new HtmlWebpackPlugin({
      inject: "body",
    }),
    new HtmlWebpackExternalsPlugin({
      externals: [
        {
          module: "jquery",
          entry: {
            path: "https://code.jquery.com/jquery-3.2.1.js",
            attributes: {
              integrity: "sha256-DZAnKJ/6XZ9si04Hgrsxu/8s717jcIzLy3oi35EouyE=",
              crossorigin: "anonymous",
            },
          },
          global: "jQuery",
        },
      ],
    }),
    new SubresourceIntegrityPlugin({ hashFuncNames: ["sha256", "sha384"] }),
    {
      apply: (compiler) => {
        compiler.hooks.done.tapPromise("wsi-test", async (stats) => {
          expect(stats.compilation.warnings).toEqual([]);

          const dom = htmlparser2.parseDocument(
            readFileSync("./dist/index.html", "utf-8")
          );

          const scripts = selectAll("script", dom);
          expect(scripts.length).toEqual(2);
          for (let i = 0; i < scripts.length; i += 1) {
            expect(scripts[0].attribs.crossorigin).toEqual("anonymous");
            expect(scripts[0].attribs.integrity).toMatch(/^sha/);
          }
        });
      },
    },
  ],
};
