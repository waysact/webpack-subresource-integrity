/**
 * Copyright (c) 2015-present, Waysact Pty Ltd
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  Module,
  Stats,
  StatsAsset,
  WebpackError,
  WebpackOptionsNormalized,
  container,
} from "webpack";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { resolve } from "path";
import tmp from "tmp-promise";
import { SubresourceIntegrityPlugin } from "..";
import { runWebpack } from "./test-utils";
import merge from "lodash/merge";

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
        entry: resolve(__dirname, "./__fixtures__/simple-project/src/."),
        plugins: [new SubresourceIntegrityPlugin()],
      },
      options
    )
  );
}

test("enabled with webpack mode=production", async () => {
  const mainAsset = (await runWebpackForSimpleProject())
    .toJson()
    .assets?.find((asset: StatsAsset) => asset.name === "main.js");
  expect(mainAsset).toBeDefined();
  expect(mainAsset?.["integrity"]).toMatch(/^sha384-\S+$/);
});

test("disabled with webpack mode=development", async () => {
  const mainAsset = (await runWebpackForSimpleProject({ mode: "development" }))
    .toJson()
    .assets?.find((asset: StatsAsset) => asset.name === "main.js");
  expect(mainAsset).toBeDefined();
  expect(mainAsset?.["integrity"]).toBeUndefined();
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

describe.each(["eager", "lazy"] as const)(
  "%s integrity hashes",
  (hashLoading) => {
    test.each([false, true])(
      "Module Federation with JavaScript in the shared chunk: %s",
      async (includeJavaScript) => {
        await tmp.withDir(
          async ({ path }) => {
            const context = resolve(
              __dirname,
              "__fixtures__/module-federation"
            );
            const stats = await runWebpack({
              context,
              mode: "production",
              devtool: false,
              entry: "./index.js",
              output: { path, crossOriginLoading: "anonymous" },
              optimization: {
                minimize: false,
                chunkIds: "named",
                splitChunks: {
                  cacheGroups: {
                    shared: {
                      test: (module: Module) =>
                        module.type === "consume-shared-module" ||
                        (includeJavaScript &&
                          module.nameForCondition() ===
                            resolve(context, "mixed.js")),
                      chunks: "all",
                      enforce: true,
                      name: "shared",
                    },
                  },
                },
              },
              plugins: [
                new SubresourceIntegrityPlugin({ hashLoading }),
                new container.ModuleFederationPlugin({
                  name: "app",
                  filename: "remoteEntry.js",
                  exposes: { "./parent": "./parent.js" },
                  shared: {
                    "./first": { singleton: true, requiredVersion: false },
                    "./second": { singleton: true, requiredVersion: false },
                  },
                }),
              ],
            });

            expect(stats.compilation.warnings).toHaveLength(0);
            const sharedChunk = stats.compilation.namedChunks.get("shared");
            expect(sharedChunk).toBeDefined();
            expect(sharedChunk?.files.size).toBe(includeJavaScript ? 1 : 0);
            expect(
              sharedChunk &&
                stats.compilation.chunkGraph.getNumberOfChunkModules(
                  sharedChunk
                )
            ).toBe(includeJavaScript ? 3 : 2);

            const hashes: Record<string, string> = {};
            for (const asset of stats.compilation.getAssets()) {
              const source = readFileSync(resolve(path, asset.name), "utf8");
              expect(source).not.toContain("*-*-*-CHUNK-SRI-HASH-");
              for (const match of source.matchAll(
                /__webpack_require__\.sriHashes(?: = |, )(\{[^\n]*\})/g
              )) {
                Object.assign(hashes, JSON.parse(match[1] as string));
              }
            }

            const expectedHashes: Record<string, string> = {};
            for (const chunk of stats.compilation.chunks) {
              if (chunk.canBeInitial()) continue;
              for (const file of chunk.files) {
                expectedHashes[chunk.id as string] =
                  "sha384-" +
                  createHash("sha384")
                    .update(readFileSync(resolve(path, file)))
                    .digest("base64");
              }
            }
            expect(Object.keys(expectedHashes).length).toBeGreaterThan(2);
            expect(hashes).toEqual(expectedHashes);
          },
          { unsafeCleanup: true }
        );
      }
    );
  }
);
