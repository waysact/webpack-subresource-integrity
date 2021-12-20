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
  plugins: [
    new SubresourceIntegrityPlugin({
      enabled: true,
      lazyHashes: true,
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
          function getSriHashes(chunkName, isEntry) {
            const fileContent = readFileSync(
              join(__dirname, "dist", `${chunkName}.js`),
              "utf-8"
            );
            const sriRegex = new RegExp(
              `${
                isEntry ? "self.sriHashes=" : "Object.assign\\(self.sriHashes,"
              }(?<sriHashJson>\{.*?\})`
            );
            const regexMatch = sriRegex.exec(fileContent);
            const sriHashJson = regexMatch ? regexMatch.groups.sriHashJson : null;
            if (!sriHashJson) {
              return null;
            }
            try {
              // The hashes are not *strict* JSON, since they can have numerical keys
              return JSON.parse(
                sriHashJson.replace(/\d+(?=:)/g, (num) => `"${num}"`)
              );
            } catch (err) {
              throw new Error(
                `Could not parse SRI hashes \n\t${sriHashJson}\n in asset: ${err}`
              );
            }
          }

          const indexHashes = getSriHashes("index", true);
          expect(Object.keys(indexHashes).length).toEqual(1);

          const _1jsHashes = getSriHashes(Object.keys(indexHashes)[0], false);
          expect(Object.keys(_1jsHashes).length).toEqual(1);

          const _2jsHashes = getSriHashes(Object.keys(_1jsHashes)[0], false);
          expect(_2jsHashes).toEqual(null);

          expect(
            stats
              .toJson()
              .assets.filter(({ name }) => /\.js$/.test(name))
              .every(({ integrity }) => !!integrity)
          ).toEqual(true);
        });
      },
    },
  ],
};
