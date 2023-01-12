/**
 * Copyright (c) 2020-present, Waysact Pty Ltd
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/*
 * Hack for applying an external source map to raw nyc coverage data.
 */
const {
  SourceMapTransformer,
} = require("istanbul-lib-source-maps/lib/transformer");
const libCoverage = require("istanbul-lib-coverage");

const globPromise = require("glob-promise");
const { readFile, writeFile } = require("fs");
const { promisify } = require("util");
const { SourceMapConsumer } = require("source-map");
const { join, basename } = require("path");

const readFilePromise = promisify(readFile);
const writeFilePromise = promisify(writeFile);

const main = async () => {
  const inDir = process.argv[2];
  const outDir = process.argv[3];

  const inputCoverageMap = libCoverage.createCoverageMap({});
  const files = await globPromise(join(inDir, "*.json"));
  await Promise.all(
    files.map(async (file) => {
      const data = JSON.parse(await readFilePromise(file, "utf-8"));
      const isTypeScript = Object.keys(data)[0]?.endsWith(".ts");
      if (isTypeScript) {
        await writeFilePromise(
          join(outDir, `${basename(file)}.json`),
          JSON.stringify(data),
          "utf-8"
        );
      } else {
        inputCoverageMap.merge(data);
      }
    })
  );

  const resultMap = await new SourceMapTransformer(
    async (file) =>
      new SourceMapConsumer(await readFilePromise(`${file}.map`, "utf-8"))
  ).transform(inputCoverageMap);

  await Promise.all(
    resultMap.files().map((f) => {
      const fc = resultMap.fileCoverageFor(f).toJSON();

      return writeFilePromise(
        join(outDir, `${basename(f)}.json`),
        JSON.stringify({ [fc.path]: fc }),
        "utf-8"
      );
    })
  );
};

main().catch(process.error);
