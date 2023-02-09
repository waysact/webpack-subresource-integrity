const { SubresourceIntegrityPlugin } = require("webpack-subresource-integrity");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const expect = require("expect");
const htmlparser2 = require("htmlparser2");
const { readFileSync } = require("fs");
const { selectAll } = require("css-select");

module.exports = {
  mode: "production",
  entry: "./index.js",
  output: {
    filename: "subdir/bundle.js",
    crossOriginLoading: "anonymous",
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: "subdir/styles.css",
      chunkFilename: "[id].css",
    }),
    new HtmlWebpackPlugin({
      hash: true,
      inject: false,
      filename: "admin.html",
      template: "index.ejs",
    }),
    new SubresourceIntegrityPlugin({ hashFuncNames: ["sha256", "sha384"] }),
    {
      apply: (compiler) => {
        compiler.hooks.done.tap("wsi-test", (stats) => {
          expect(stats.compilation.warnings).toEqual([]);
          expect(stats.compilation.errors).toEqual([]);

          const jsIntegrity = stats
            .toJson()
            .assets.find(
              (asset) => asset.name === "subdir/bundle.js"
            ).integrity;
          expect(jsIntegrity).toMatch(/^sha/);

          const cssIntegrity = stats
            .toJson()
            .assets.find(
              (asset) => asset.name === "subdir/styles.css"
            ).integrity;
          expect(cssIntegrity).toMatch(/^sha/);

          const dom = htmlparser2.parseDocument(
            readFileSync("./dist/admin.html", "utf-8")
          );

          const scripts = selectAll("script", dom);
          expect(scripts.length).toEqual(1);
          expect(scripts[0].attribs.crossorigin).toEqual("anonymous");
          expect(scripts[0].attribs.integrity).toEqual(jsIntegrity);

          const links = selectAll("link", dom);
          expect(links.length).toEqual(1);
          expect(links[0].attribs.crossorigin).toEqual("anonymous");
          expect(links[0].attribs.integrity).toEqual(cssIntegrity);
        });
      },
    },
  ],
};
