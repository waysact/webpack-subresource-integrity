import type { Compiler, Compilation } from "webpack";
import { getHtmlWebpackPluginHooksType } from "./types";
import { thisPluginName } from "./globals";

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
      if (e.code !== "MODULE_NOT_FOUND") {
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
