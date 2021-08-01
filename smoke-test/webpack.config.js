const { SubresourceIntegrityPlugin } = require("webpack-subresource-integrity");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const expect = require("expect");
const { join } = require("path");
const puppeteer = require("puppeteer");
const handler = require("serve-handler");
const http = require("http");
const tmp = require("tmp");
const { copySync } = require("fs-extra");
const { appendFileSync } = require("fs");

const copyAndServe = (directory, manipulate) =>
  new Promise((resolve, reject) => {
    try {
      const { name: public } = tmp.dirSync();
      copySync(directory, public);
      manipulate(public);

      const server = http.createServer((request, response) =>
        handler(request, response, {
          public,
        })
      );

      server.listen(async () => {
        try {
          const messages = [];
          const browser = await puppeteer.launch();
          const page = await browser.newPage();
          page.on("console", (message) => {
            messages.push(message);
          });

          await page.goto(`http://localhost:${server.address().port}`, {
            waitUntil: "networkidle2",
          });

          server.close();
          await browser.close();

          resolve(messages);
        } catch (error) {
          reject(error);
        }
      });
    } catch (error) {
      reject(error);
    }
  });

const isOkMessage = (consoleMessage) =>
  consoleMessage.type() === "log" && consoleMessage.text() === "ok";

const isErrorOrWarningMessage = (consoleMessage) =>
  ["error", "warning"].includes(consoleMessage.type());

const isSriErrorMessage = (consoleMessage) =>
  consoleMessage.type() === "error" &&
  consoleMessage
    .text()
    .match(
      /Failed to find a valid digest in the 'integrity' attribute for resource/
    );

module.exports = {
  mode: "production",
  output: {
    crossOriginLoading: "anonymous",
  },
  plugins: [
    new HtmlWebpackPlugin(),
    new SubresourceIntegrityPlugin(),
    {
      apply: (compiler) => {
        compiler.hooks.done.tap("wsi-test", (stats) => {
          const statsJson = stats.toJson();
          expect(statsJson.warnings).toHaveLength(0);
          expect(statsJson.errors).toHaveLength(0);

          (async function () {
            // Ensure the page loads when all chunks are intact
            const messagesWithNoneCorrupt = await copyAndServe(
              stats.compilation.compiler.outputPath,
              (public) => {}
            );
            expect(messagesWithNoneCorrupt.find(isOkMessage)).toBeDefined();
            expect(
              messagesWithNoneCorrupt.find(isErrorOrWarningMessage)
            ).toBeUndefined();

            // Ensure the page fails to load when the main chunk is corrupted
            const messagesWithMainCorrupt = await copyAndServe(
              stats.compilation.compiler.outputPath,
              (public) => appendFileSync(join(public, "main.js"), "\n")
            );
            expect(messagesWithMainCorrupt.find(isOkMessage)).toBeUndefined();
            expect(
              messagesWithMainCorrupt.find(isSriErrorMessage)
            ).toBeDefined();

            // Ensure the page fails to load when the lazy chunk is corrupted
            const chunkAsset = statsJson.assets.find(
              (asset) => !["index.html", "main.js"].includes(asset.name)
            );
            const messagesWithChunkCorrupt = await copyAndServe(
              stats.compilation.compiler.outputPath,
              (public) => appendFileSync(join(public, chunkAsset.name), "\n")
            );
            expect(messagesWithChunkCorrupt.find(isOkMessage)).toBeUndefined();
            expect(
              messagesWithChunkCorrupt.find(isSriErrorMessage)
            ).toBeDefined();

            console.log("Smoke test successful.");
          })();
        });
      },
    },
  ],
};
