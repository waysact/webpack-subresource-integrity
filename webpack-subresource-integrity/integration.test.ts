/**
 * Copyright (c) 2015-present, Waysact Pty Ltd
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import webpack, { Stats, StatsError } from "webpack";
import { resolve, join } from "path";
import tmp from "tmp-promise";
const { SubresourceIntegrityPlugin } = require("./index.js");
import { readdirSync, readFileSync } from "fs";
import { promisify } from "util";
const readFilePromise = promisify(readFileSync);

const errorFromStats = (stats: Stats | undefined): Error => {
  const errors = stats?.toJson()?.errors;
  if (!errors) {
    return new Error("No stats");
  }
  return new Error(
    "Error:" + errors.map((error: StatsError) => error.message).join(", ")
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
  const tmpDir = await tmp.dir({ unsafeCleanup: true });
  const stats = await runWebpack({
    output: { path: tmpDir.path },
    entry: resolve(__dirname, "./test-fixtures/simple-project/src/index.js"),
    plugins: [new SubresourceIntegrityPlugin()],
  });
  const mainAsset = stats
    .toJson()
    .assets?.find((asset: any) => asset.name === "main.js");
  expect(mainAsset).toBeDefined();
  expect(mainAsset?.integrity).toMatch(/^sha384-\S+$/);
  tmpDir.cleanup();
});

test("disabled with webpack mode=development", async () => {
  const tmpDir = await tmp.dir({ unsafeCleanup: true });
  const stats = await runWebpack({
    mode: "development",
    output: { path: tmpDir.path },
    entry: resolve(__dirname, "./test-fixtures/simple-project/src/index.js"),
    plugins: [new SubresourceIntegrityPlugin()],
  });
  const mainAsset = stats
    .toJson()
    .assets?.find((asset: any) => asset.name === "main.js");
  expect(mainAsset).toBeDefined();
  expect(mainAsset?.integrity).toBeUndefined();
  tmpDir.cleanup();
});
