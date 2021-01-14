/**
 * Copyright (c) 2015-present, Waysact Pty Ltd
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import webpack, { Stats } from "webpack";
import { resolve, join } from "path";
import tmp from "tmp";
const { SubresourceIntegrityPlugin } = require("./index.js");
import { readdirSync, readFileSync } from "fs";
import { promisify } from "util";
const readFilePromise = promisify(readFileSync);

const errorFromStats = (stats: Stats | undefined): Error => {
  if (!stats) {
    return new Error("No stats");
  }
  return new Error(
    "Error:" +
      stats
        .toJson()
        .errors.map((error: Error) => error.message)
        .join(", ")
  );
};

const runWebpack = (options: any): Promise<Stats> =>
  new Promise((resolve, reject) => {
    webpack(options, (err, stats) => {
      if (err) {
        reject(err);
      } else if (stats?.hasErrors() === false) {
        resolve(stats);
      } else {
        reject(errorFromStats(stats));
      }
    });
  });

test("enabled with webpack mode=production", async () => {
  const tmpDir = tmp.dirSync({ unsafeCleanup: true });
  const stats = await runWebpack({
    output: { path: tmpDir.name },
    entry: resolve(__dirname, "./test-fixtures/simple-project/src/index.js"),
    plugins: [new SubresourceIntegrityPlugin()],
  });
  const mainAsset = stats
    .toJson()
    .assets.find((asset: any) => asset.name === "main.js");
  expect(mainAsset.integrity).toMatch(/^sha384-\S+$/);
  tmpDir.removeCallback();
});

test("disabled with webpack mode=development", async () => {
  const tmpDir = tmp.dirSync({ unsafeCleanup: true });
  const stats = await runWebpack({
    mode: "development",
    output: { path: tmpDir.name },
    entry: resolve(__dirname, "./test-fixtures/simple-project/src/index.js"),
    plugins: [new SubresourceIntegrityPlugin()],
  });
  const mainAsset = stats
    .toJson()
    .assets.find((asset: any) => asset.name === "main.js");
  expect(mainAsset.integrity).toBeUndefined();
  tmpDir.removeCallback();
});
