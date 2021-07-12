/**
 * Copyright (c) 2015-present, Waysact Pty Ltd
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { resolve } from "path";
import { SubresourceIntegrityPlugin } from "./index.js";
import { runWebpack } from "./test-utils";

jest.mock("html-webpack-plugin");

test("error when loading html-webpack-plugin", async () => {
  await expect(
    runWebpack({
      entry: resolve(__dirname, "./test-fixtures/simple-project/src/index.js"),
      plugins: [new SubresourceIntegrityPlugin()],
    })
  ).rejects.toThrow("bogus hwp accessed");
});
