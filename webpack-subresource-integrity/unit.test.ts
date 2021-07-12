/**
 * Copyright (c) 2015-present, Waysact Pty Ltd
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import webpack, {
  Compiler,
  Compilation,
  Configuration,
  Chunk,
  Stats,
  sources,
} from "webpack";
import { AsyncSeriesHook, SyncHook } from "tapable";
import HtmlWebpackPlugin from "html-webpack-plugin";
import { createFsFromVolume, Volume } from "memfs";
const { SubresourceIntegrityPlugin } = require("./index.js");
type WebpackErrors = Compilation["errors"];
type OutputOptions = { crossOriginLoading: boolean };

process.on("unhandledRejection", (error) => {
  console.log(error);
  process.exit(1);
});

test("throws an error when options is not an object", async () => {
  expect(() => {
    new SubresourceIntegrityPlugin(function dummy() {} as unknown as {
      hashFuncNames: string[];
    }); // eslint-disable-line no-new
  }).toThrow(/argument must be an object/);
});

const runCompilation = (compiler: Compiler) =>
  new Promise<Compilation>((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) {
        reject(err);
      } else if (!stats) {
        reject(new Error("Missing stats"));
      } else {
        resolve(stats.compilation);
      }
    });
  });

const defaultOptions: Partial<Configuration> = {
  mode: "none",
  entry: "./test-fixtures/simple-project/src/index.js",
  output: {
    crossOriginLoading: "anonymous",
  },
};

test("warns when no standard hash function name is specified", async () => {
  const plugin = new SubresourceIntegrityPlugin({
    hashFuncNames: ["md5"],
  });

  const compilation = await runCompilation(
    webpack({
      ...defaultOptions,
      plugins: [plugin],
    })
  );

  expect(compilation.errors).toEqual([]);
  expect(compilation.warnings[0]).toBeInstanceOf(Error);
  expect(compilation.warnings[0].message).toMatch(
    new RegExp(
      "It is recommended that at least one hash function is part of " +
        "the set for which support is mandated by the specification"
    )
  );
  expect(compilation.warnings[1]).toBeUndefined();
});

test("supports new constructor with array of hash function names", async () => {
  const plugin = new SubresourceIntegrityPlugin({
    hashFuncNames: ["sha256", "sha384"],
  });

  const compilation = await runCompilation(
    webpack({
      ...defaultOptions,
      plugins: [plugin],
    })
  );

  expect(compilation.errors.length).toBe(0);
  expect(compilation.warnings.length).toBe(0);
});

test("errors if hash function names is not an array", async () => {
  const plugin = new SubresourceIntegrityPlugin({
    hashFuncNames: "sha256" as unknown as string[],
  });

  const compilation = await runCompilation(
    webpack({
      ...defaultOptions,
      plugins: [plugin],
    })
  );

  expect(compilation.errors.length).toBe(1);
  expect(compilation.warnings.length).toBe(0);
  expect(compilation.errors[0].message).toMatch(
    /options.hashFuncNames must be an array of hash function names, instead got 'sha256'/
  );
});

test("errors if hash function names contains non-string", async () => {
  const plugin = new SubresourceIntegrityPlugin({
    hashFuncNames: [1234] as unknown as string[],
  });

  const compilation = await runCompilation(
    webpack({
      ...defaultOptions,
      plugins: [plugin],
    })
  );

  expect(compilation.errors.length).toBe(1);
  expect(compilation.warnings.length).toBe(0);
  expect(compilation.errors[0].message).toMatch(
    /options.hashFuncNames must be an array of hash function names, but contained 1234/
  );
});

test("errors if hash function names contains unsupported digest", async () => {
  const plugin = new SubresourceIntegrityPlugin({
    hashFuncNames: ["frobnicate"],
  });

  const compilation = await runCompilation(
    webpack({
      ...defaultOptions,
      plugins: [plugin],
    })
  );

  expect(compilation.errors.length).toBe(1);
  expect(compilation.warnings.length).toBe(0);
  expect(compilation.errors[0].message).toMatch(
    /Cannot use hash function 'frobnicate': Digest method not supported/
  );
});

test("uses default options", async () => {
  const plugin = new SubresourceIntegrityPlugin({
    hashFuncNames: ["sha256"],
  });

  const compilation = await runCompilation(
    webpack({
      ...defaultOptions,
      plugins: [plugin],
    })
  );

  expect(plugin.options.hashFuncNames).toEqual(["sha256"]);
  expect(plugin.options.enabled).toBeTruthy();
  expect(plugin.options.deprecatedOptions).toBeFalsy();
  expect(compilation.errors.length).toBe(0);
  expect(compilation.warnings.length).toBe(0);
});

test("should warn when output.crossOriginLoading is not set", async () => {
  const plugin = new SubresourceIntegrityPlugin({ hashFuncNames: ["sha256"] });

  const compilation = await runCompilation(
    webpack({
      ...defaultOptions,
      output: { crossOriginLoading: false },
      plugins: [plugin],
    })
  );

  compilation.mainTemplate.hooks.jsonpScript.call("", {} as unknown as Chunk);
  compilation.mainTemplate.hooks.linkPreload.call("", {} as unknown as Chunk);

  expect(compilation.errors.length).toBe(1);
  expect(compilation.warnings.length).toBe(1);
  expect(compilation.warnings[0].message).toMatch(
    /Set webpack option output\.crossOriginLoading/
  );
  expect(compilation.errors[0].message).toMatch(
    /webpack option output\.crossOriginLoading not set, code splitting will not work!/
  );
});

test("should ignore tags without attributes", async () => {
  const plugin = new SubresourceIntegrityPlugin({ hashFuncNames: ["sha256"] });

  const compilation = await runCompilation(
    webpack({
      ...defaultOptions,
      plugins: [plugin],
    })
  );

  const tag = {
    tagName: "script",
    voidTag: false,
    attributes: {},
  };

  HtmlWebpackPlugin.getHooks(
    compilation as unknown as Compilation
  ).alterAssetTagGroups.promise({
    headTags: [],
    bodyTags: [tag],
    outputName: "foo",
    plugin: new HtmlWebpackPlugin(),
  });

  expect(Object.keys(tag.attributes)).not.toContain(["integrity"]);
  expect(compilation.errors).toEqual([]);
  expect(compilation.warnings).toEqual([]);
});
