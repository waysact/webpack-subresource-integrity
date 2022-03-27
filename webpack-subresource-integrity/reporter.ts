/**
 * Copyright (c) 2015-present, Waysact Pty Ltd
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Compilation } from "webpack";
import { thisPluginName, standardHashFuncNames } from "./globals";
import { hasOwnProperty } from "./util";

function errorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    hasOwnProperty(error, "message")
  ) {
    return error.message;
  }
  return String(error);
}

export class Reporter {
  /**
   * @internal
   */
  private compilation: Compilation;

  /**
   * @internal
   */
  private emittedMessages: Set<string> = new Set();

  /**
   * @internal
   */
  public constructor(compilation: Compilation) {
    this.compilation = compilation;
  }

  /**
   * @internal
   */
  private emitMessage(messages: Error[], message: string): void {
    messages.push(new Error(`${thisPluginName}: ${message}`));
  }

  /**
   * @internal
   */
  private emitMessageOnce(messages: Error[], message: string): void {
    if (!this.emittedMessages.has(message)) {
      this.emittedMessages.add(message);
      this.emitMessage(messages, message);
    }
  }

  /**
   * @internal
   */
  public warnOnce(message: string): void {
    this.emitMessageOnce(this.compilation.warnings, message);
  }

  /**
   * @internal
   */
  public errorOnce(message: string): void {
    this.emitMessageOnce(this.compilation.errors, message);
  }

  /**
   * @internal
   */
  public error(message: string): void {
    this.emitMessage(this.compilation.errors, message);
  }

  public warnHotReloading(): void {
    this.warnOnce(
      "webpack-subresource-integrity may interfere with hot reloading. " +
        "Consider disabling this plugin in development mode."
    );
  }

  public warnContentHash(): void {
    this.warnOnce(
      "Using [hash], [fullhash], [modulehash], or [chunkhash] is dangerous \
with SRI. The same is true for [contenthash] when realContentHash is disabled. \
Use [contenthash] and ensure realContentHash is enabled. See the README for \
more information."
    );
  }

  public warnNoAssetsFound(sourcePath: string, assetNames: string[]): void {
    this.warnOnce(
      `No asset found for source path '${sourcePath}', options are ${assetNames.join(
        ", "
      )}`
    );
  }

  public errorCrossOriginLoadingNotSet(): void {
    this.errorOnce(
      "webpack option output.crossOriginLoading not set, code splitting will not work!"
    );
  }

  public warnStandardHashFuncs(): void {
    this.warnOnce(
      "It is recommended that at least one hash function is part of the set " +
        "for which support is mandated by the specification. " +
        "These are: " +
        standardHashFuncNames.join(", ") +
        ". " +
        "See http://www.w3.org/TR/SRI/#cryptographic-hash-functions for more information."
    );
  }

  public errorInvalidHashLoading(
    hashLoading: string,
    supportedHashLoadingOptions: readonly string[]
  ): void {
    const optionsStr = supportedHashLoadingOptions
      .map((opt) => `'${opt}'`)
      .join(", ");

    this.error(
      `options.hashLoading must be one of ${optionsStr}, instead got '${hashLoading}'`
    );
  }

  public warnCrossOriginPolicy(): void {
    this.warnOnce(
      'SRI requires a cross-origin policy, defaulting to "anonymous". ' +
        "Set webpack option output.crossOriginLoading to a value other than false " +
        "to make this warning go away. " +
        "See https://w3c.github.io/webappsec-subresource-integrity/#cross-origin-data-leakage"
    );
  }

  public errorNonStringHashFunc(hashFuncName: unknown): void {
    this.error(
      "options.hashFuncNames must be an array of hash function names, " +
        "but contained " +
        hashFuncName +
        "."
    );
  }

  public errorUnusableHashFunc(hashFuncName: string, error: unknown): void {
    this.error(
      "Cannot use hash function '" + hashFuncName + "': " + errorMessage(error)
    );
  }

  public errorHashFuncsNonArray(hashFuncNames: unknown): void {
    this.error(
      "options.hashFuncNames must be an array of hash function names, " +
        "instead got '" +
        hashFuncNames +
        "'."
    );
  }

  public errorHashFuncsEmpty(): void {
    this.error("Must specify at least one hash function name.");
  }

  public warnNonWeb(): void {
    this.warnOnce("This plugin is not useful for non-web targets.");
  }

  public errorUnresolvedIntegrity(chunkFile: string): void {
    this.errorOnce(
      `Asset ${chunkFile} contains unresolved integrity placeholders`
    );
  }
}
