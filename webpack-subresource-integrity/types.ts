import type HtmlWebpackPlugin from "html-webpack-plugin";
import type { Compilation } from "webpack";

export type HtmlTagObject = HtmlWebpackPlugin.HtmlTagObject;
export type getHtmlWebpackPluginHooksType = (
  compilation: Compilation
) => HtmlWebpackPlugin.Hooks;

/**
 * @internal
 */
export interface SubresourceIntegrityPluginResolvedOptions {
  readonly hashFuncNames: [string, ...string[]];
  readonly enabled: "auto" | true | false;
}
