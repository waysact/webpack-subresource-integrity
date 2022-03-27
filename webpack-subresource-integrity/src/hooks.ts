/**
 * Copyright (c) 2015-present, Waysact Pty Ltd
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Compiler, Compilation } from "webpack";
import { getHtmlWebpackPluginHooksType } from "./types";
import { thisPluginName } from "./globals";
import { hasOwnProperty } from "./util";

interface StatsObjectWithIntegrity {
  integrity: string;
}

type StatsFactory = ReturnType<Compilation["createStatsFactory"]>;

function sriStatsFactory(statsFactory: StatsFactory) {
  statsFactory.hooks.extract
    .for("asset")
    .tap(thisPluginName, (object, asset) => {
      const contenthash = asset.info?.contenthash;
      if (contenthash) {
        const shaHashes = (
          Array.isArray(contenthash) ? contenthash : [contenthash]
        ).filter((hash: unknown) => String(hash).match(/^sha[0-9]+-/));
        if (shaHashes.length > 0) {
          (object as unknown as StatsObjectWithIntegrity).integrity =
            shaHashes.join(" ");
        }
      }
    });
}

function installStatsFactoryPlugin(compiler: Compiler) {
  compiler.hooks.compilation.tap(thisPluginName, (compilation: Compilation) => {
    compilation.hooks.statsFactory.tap(thisPluginName, sriStatsFactory);
  });
}

interface ErrnoException extends Error {
  errno?: number | undefined;
  code?: string | undefined;
  path?: string | undefined;
  syscall?: string | undefined;
}

function isErrorWithCode(obj: unknown): obj is Pick<ErrnoException, "code"> {
  return (
    obj instanceof Error &&
    hasOwnProperty(obj, "code") &&
    ["string", "undefined"].includes(typeof obj.code)
  );
}

export function install(
  compiler: Compiler,
  callback: (
    compilation: Compilation,
    hwpHooks: ReturnType<getHtmlWebpackPluginHooksType> | null
  ) => void
): void {
  let getHtmlWebpackPluginHooks: getHtmlWebpackPluginHooksType | null = null;
  compiler.hooks.beforeCompile.tapPromise(thisPluginName, async () => {
    try {
      getHtmlWebpackPluginHooks = (await import("html-webpack-plugin")).default
        .getHooks;
    } catch (e) {
      if (!isErrorWithCode(e) || e.code !== "MODULE_NOT_FOUND") {
        throw e;
      }
    }
  });

  compiler.hooks.afterPlugins.tap(thisPluginName, (compiler) => {
    compiler.hooks.thisCompilation.tap(
      {
        name: thisPluginName,
        stage: -10000,
      },
      (compilation) => {
        callback(compilation, getHtmlWebpackPluginHooks?.(compilation) || null);
      }
    );

    installStatsFactoryPlugin(compiler);
  });
}
