/**
 * Copyright (c) 2020-present, Waysact Pty Ltd
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import getPort from "get-port";
import puppeteer from "puppeteer";
import Fastify from "fastify";
import FastifyStatic from "fastify-static";
import { resolve } from "path";
import type { Compiler, Stats } from "webpack";

type PuppeteerOptions = {
  onPageError?: (err: Error) => void;
  onError?: (err: Error) => void;
  onConsoleError?: (err: string) => void;
  onStart?: (stats: Stats) => void | Promise<void>;
  onDone?: () => void;
};

export async function testWithPuppeteer(
  stats: Stats,
  options: PuppeteerOptions
) {
  if (options.onStart) {
    await Promise.resolve(options.onStart(stats));
  }

  const port = await getPort();
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const fastify = Fastify({ logger: true });

  try {
    fastify.register(FastifyStatic, {
      root: resolve("dist"),
    });

    /* const address = */ await fastify.listen(port);

    const page = await browser.newPage();

    page.on(
      "pageerror",
      options.onPageError ||
        ((err) => {
          process.stderr.write("Error: " + err.toString() + "\n");
        })
    );

    page.on(
      "error",
      options.onError ||
        ((err) => {
          process.stderr.write("Page Error: " + err.toString() + "\n");
        })
    );

    const resultPromise = new Promise<void>((resolve, reject) => {
      page.on("console", (msg) => {
        Promise.all(msg.args().map((arg) => arg.jsonValue())).then((args) => {
          if (args.length === 0) {
            if (msg.type() === "error") {
              (
                options.onConsoleError ||
                ((text) =>
                  process.stderr.write(
                    "Console: " + msg.type() + ": " + text + "\n"
                  ))
              )(msg.text());
            }
          } else if (args[0] === "ok") {
            resolve();
          } else if (args[0] === "error") {
            reject(new Error(args.slice(1).join(" ")));
          } else {
            process.stderr.write("Console: " + args.join(" ") + "\n");
          }
        });
      });
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("Timeout loading page"));
      }, 10000);
    });

    await Promise.all([
      page.goto(`http://localhost:${port}/`, {
        waitUntil: "networkidle0",
      }),
      Promise.race([resultPromise, timeoutPromise]),
    ]);

    if (options.onDone) options.onDone();
  } finally {
    browser.close();
    fastify.close();
  }
}

export class RunInPuppeteerPlugin {
  options: PuppeteerOptions;

  constructor(options: PuppeteerOptions = {}) {
    this.options = options;
  }

  apply(compiler: Compiler) {
    compiler.hooks.done.tapPromise("wsi-test", async (stats: Stats) => {
      if (stats.compilation.errors.length === 0) {
        await testWithPuppeteer(stats, this.options);
      }
    });
  }
}
