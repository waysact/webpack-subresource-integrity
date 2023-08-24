const { SubresourceIntegrityPlugin } = require("webpack-subresource-integrity");
const expect = require("expect");
const container = require("webpack").container;

const { ModuleFederationPlugin } = container;

module.exports = {
  entry: {
    index: "./index.js",
  },
  output: {
    crossOriginLoading: "anonymous",
  },
  plugins: [
    new SubresourceIntegrityPlugin({
      hashFuncNames: ["sha256"],
      enabled: true,
    }),
    new ModuleFederationPlugin({
      name: "host",
      filename: "remoteEntry.js",
      remotes: {
        app1: "app1@http://localhost:3001/remoteEntry.js",
      },
      exposes: {
        "./remote": "./bootstrap",
      },
      shared: {
        lodash: {
          singleton: true,
          eager: true,
        },
      },
    }),
    {
      apply: (compiler) => {
        compiler.hooks.done.tap("wsi-test", (stats) => {
          const assets = stats.toJson().assets;

          assets.forEach((asset) => {
            expect(asset).not.toContain("*-*-*-CHUNK-SRI-HASH-");
          });
        });
      },
    },
  ],
};
