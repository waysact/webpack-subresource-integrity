/**
 * Copyright (c) 2015-present, Waysact Pty Ltd
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { StatsAsset } from "webpack";
import { resolve } from "path";
import tmp from "tmp-promise";
import { SubresourceIntegrityPlugin } from "./index.js";
import { runWebpack } from "./test-utils";

jest.unmock("html-webpack-plugin");

test("enabled with webpack mode=production", async () => {
  const tmpDir = await tmp.dir({ unsafeCleanup: true });
  const stats = await runWebpack({
    output: { path: tmpDir.path },
    entry: resolve(__dirname, "./test-fixtures/simple-project/src/index.js"),
    plugins: [new SubresourceIntegrityPlugin()],
  });
  const mainAsset = stats
    .toJson()
    .assets?.find((asset: StatsAsset) => asset.name === "main.js");
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
    .assets?.find((asset: StatsAsset) => asset.name === "main.js");
  expect(mainAsset).toBeDefined();
  expect(mainAsset?.integrity).toBeUndefined();
  tmpDir.cleanup();
});
