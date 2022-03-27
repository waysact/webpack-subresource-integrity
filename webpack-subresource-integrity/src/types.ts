import type HtmlWebpackPlugin from "html-webpack-plugin";
import type { Compilation } from "webpack";

export type HtmlTagObject = HtmlWebpackPlugin.HtmlTagObject;
export type getHtmlWebpackPluginHooksType = (
  compilation: Compilation
) => HtmlWebpackPlugin.Hooks;

/**
 * @public
 */
export interface SubresourceIntegrityPluginOptions {
  readonly hashFuncNames?: [string, ...string[]];
  readonly enabled?: "auto" | true | false;
  readonly hashLoading?: "eager" | "lazy";
}

export type SubresourceIntegrityPluginResolvedOptions =
  Required<SubresourceIntegrityPluginOptions>;

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

type ImmutablePrimitive = string | number | boolean | undefined | null;

/* eslint-disable no-use-before-define */

// type ImmutableArray<T> = ReadonlyArray<Immutable<T>>;

type ImmutableSet<T> = ReadonlySet<Immutable<T>>;

type ImmutableMap<K, V> = ReadonlyMap<Immutable<K>, Immutable<V>>;

type ImmutableObject<T> = {
  readonly [P in keyof T]: Immutable<T[P]>;
};
export type Immutable<T> = T extends ImmutablePrimitive
  ? T
  : //T extends Array<infer U> ? ImmutableArray<U> :   <-- not needed
  T extends Map<infer K, infer V>
  ? ImmutableMap<K, V>
  : T extends Set<infer M>
  ? ImmutableSet<M>
  : ImmutableObject<T>;

/* eslint-enable no-use-before-define */
