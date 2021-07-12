/**
 * Copyright (c) 2015-present, Waysact Pty Ltd
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Compilation } from "webpack";

export class Reporter {
  /**
   * @internal
   */
  private compilation: Compilation;

  /**
   * @internal
   */
  private pluginName: string;

  /**
   * @internal
   */
  private emittedMessages: Set<string> = new Set();

  /**
   * @internal
   */
  public constructor(compilation: Compilation, pluginName: string) {
    this.compilation = compilation;
    this.pluginName = pluginName;
  }

  /**
   * @internal
   */
  private emitMessage(messages: Error[], message: string): void {
    messages.push(new Error(`${this.pluginName}: ${message}`));
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
}
