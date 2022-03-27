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
  readonly hashLoading: "eager" | "lazy";
}

export interface Graph<T> {
  vertices: Set<T>;
  edges: Map<T, Set<T>>;
}

export interface StronglyConnectedComponent<T> {
  nodes: Set<T>;
}

export type AssetType = "js" | "css";

export type TemplateFiles = { [key in AssetType]: string[] };

export interface HWPAssets {
  publicPath: string;
  js: string[];
  css: string[];
  favicon?: string | undefined;
  manifest?: string | undefined;
}

export interface WSIHWPAssets extends HWPAssets {
  jsIntegrity: string[];
  cssIntegrity: string[];
}

type KeysOfType<T, TProp> = {
  [P in keyof T]: T[P] extends TProp ? P : never;
}[keyof T];

export type WSIHWPAssetsIntegrityKey = KeysOfType<WSIHWPAssets, string[]>;
