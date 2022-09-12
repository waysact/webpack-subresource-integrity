/**
 * Copyright (c) 2015-present, Waysact Pty Ltd
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  Stats,
  StatsAsset,
  WebpackError,
  WebpackOptionsNormalized,
  container,
} from "webpack";
import { resolve } from "path";
import tmp from "tmp-promise";
import {
  SubresourceIntegrityPlugin,
  SubresourceIntegrityPluginOptions,
} from "./index.js";
import { runWebpack } from "./test-utils";
import merge from "lodash/merge";

const { ModuleFederationPlugin } = container;

jest.unmock("html-webpack-plugin");

async function runWebpackForSimpleProject(
  options: Partial<WebpackOptionsNormalized> = {}
): Promise<Stats> {
  const tmpDir = await tmp.dir({ unsafeCleanup: true });
  return await runWebpack(
    merge(
      {
        mode: "production",
        output: { path: tmpDir.path, crossOriginLoading: "anonymous" },
        entry: resolve(
          __dirname,
          "./test-fixtures/simple-project/src/index.js"
        ),
        plugins: [new SubresourceIntegrityPlugin()],
      },
      options
    )
  );
}

async function runWebpackForModuleFederationProject(
  options: Partial<SubresourceIntegrityPluginOptions> = {}
): Promise<Stats> {
  const tmpDir = await tmp.dir({ unsafeCleanup: true });
  return await runWebpack({
    mode: "production",
    output: { path: tmpDir.path, crossOriginLoading: "anonymous" },
    entry: resolve(__dirname, "./test-fixtures/module-federation/src/index.js"),
    plugins: [
      new SubresourceIntegrityPlugin(options),
      new ModuleFederationPlugin({
        name: "host",
        remotes: {
          module: "module@localhost:3000/remoteEntry.js",
        },
      }),
    ],
  });
}

test("enabled with webpack mode=production", async () => {
  const mainAsset = (await runWebpackForSimpleProject())
    .toJson()
    .assets?.find((asset: StatsAsset) => asset.name === "main.js");
  expect(mainAsset).toBeDefined();
  expect(mainAsset?.integrity).toMatch(/^sha384-\S+$/);
});

test("disabled with webpack mode=development", async () => {
  const mainAsset = (await runWebpackForSimpleProject({ mode: "development" }))
    .toJson()
    .assets?.find((asset: StatsAsset) => asset.name === "main.js");
  expect(mainAsset).toBeDefined();
  expect(mainAsset?.integrity).toBeUndefined();
});

const isHashWarning = (warning: WebpackError) =>
  warning.message.match(/Use \[contenthash\] and ensure realContentHash/);

test("warns when [fullhash] is used", async () => {
  const stats = await runWebpackForSimpleProject({
    output: { filename: "[fullhash].js" },
  });

  expect(stats.compilation.warnings.find(isHashWarning)).toBeDefined();
});

test("warns when [contenthash] is used without realContentHash", async () => {
  const stats = await runWebpackForSimpleProject({
    output: { filename: "[contenthash].js" },
    optimization: { realContentHash: false },
  });

  expect(stats.compilation.warnings.find(isHashWarning)).toBeDefined();
});

test("doesn't warn when [contenthash] is used with realContentHash", async () => {
  const stats = await runWebpackForSimpleProject({
    output: { filename: "[contenthash].js" },
    optimization: { realContentHash: true },
  });

  expect(stats.compilation.warnings).toHaveLength(0);
});

test("doesn't warn with default options", async () => {
  const stats = await runWebpackForSimpleProject();

  expect(stats.compilation.warnings).toHaveLength(0);
});

test("fail on module federation", async () => {
  try {
    const stats = await runWebpackForModuleFederationProject();
  } catch (error) {
    expect(
      error.message.includes(
        "Asset main.js contains unresolved integrity placeholders"
      )
    ).toBeTruthy();
  }
});

test("can skip chunks", async () => {
  const stats = await runWebpackForModuleFederationProject({
    skipChunkNames: ["main"],
  });

  expect(stats.compilation.warnings).toHaveLength(0);
});
