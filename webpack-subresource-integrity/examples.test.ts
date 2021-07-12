/**
 * Copyright (c) 2015-present, Waysact Pty Ltd
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readdirSync } from "fs";
import { spawn } from "child_process";
import { join } from "path";
import rimraf from "rimraf";
import { promisify } from "util";

jest.unmock("html-webpack-plugin");

jest.setTimeout(120000);

const rimrafPromise = promisify(rimraf);

readdirSync("../examples/").forEach((example) => {
  test.concurrent(example, async () => {
    const exampleDirectory = join("../examples", example);
    await rimrafPromise(join(exampleDirectory, "dist"));

    await new Promise<void>((resolve, reject) => {
      const stdout: string[] = [];
      const stderr: string[] = [];

      const yarn = spawn(
        "yarn",
        process.env.USE_COVERAGE
          ? [
              "nyc",
              "--instrument=false",
              "--cwd=../..",
              "--clean=false",
              "--source-map=false",
              "webpack",
              "--no-stats",
            ]
          : ["webpack", "--no-stats"],
        {
          cwd: exampleDirectory,
          stdio: ["ignore", "pipe", "pipe"],
        }
      );
      yarn.stdout.on("data", (data) => {
        stdout.push(data);
      });
      yarn.stderr.on("data", (data) => {
        stderr.push(data);
      });
      yarn.on("exit", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(
              `child process exited with code ${code}: ${stdout.join(
                ""
              )} ${stderr.join("")}`
            )
          );
        }
      });
      yarn.on("error", reject);
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
