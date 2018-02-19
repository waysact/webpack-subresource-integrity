var glob = require("glob");
var fs = require("fs");
var path = require("path");
var webpack = require("webpack");
var merge = require("lodash/merge");
var connect = require("connect");
var serveStatic = require("serve-static");
var getPort = require("get-port");
var check = require("check-node-version");
var httpShutdown = require("http-shutdown");
var moduleAlias = require("module-alias");
var Promise = require("bluebird");
var rimraf = require("rimraf");
var webpackVersion = Number(
  require("webpack/package.json").version.split(".")[0]
);

var defaultCheck = require("./defaultCheck");

moduleAlias.addAlias(
  "webpack-subresource-integrity",
  path.join(__dirname, "../index.js")
);

describe("Examples", function describe() {
  var browser;
  var port;

  before(function before(done) {
    Promise.promisify(rimraf)(path.join(__dirname, "../examples/*/dist"))
      .then(() => getPort())
      .then(_port => {
        port = _port;
        check({ node: ">= 6.4.0" }, (error, results) => {
          if (error) {
            done(error);
            return;
          }

          if (!results.isSatisfied) {
            done();
            return;
          }

          require("puppeteer") // eslint-disable-line global-require
            .launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] })
            .then(_browser => {
              browser = _browser;
              done();
            })
            .catch(done);
        });
      })
      .catch(done);
  });

  after(function after() {
    process.chdir(__dirname);
  });

  glob.sync("examples/*").forEach(relativeDir => {
    var dir = path.resolve(relativeDir);
    var descriptionFile;
    var description;
    var testFile;
    var test;
    var server;
    var testFunc;

    if (!fs.lstatSync(dir).isDirectory(dir)) {
      return;
    }
    descriptionFile = path.join(dir, "README.md");
    if (fs.existsSync(descriptionFile)) {
      description = fs
        .readFileSync(descriptionFile, "utf-8")
        .split("\n")[0]
        .replace(/#+\s+/, "")
        .trim();
    } else {
      description = path.basename(dir);
    }
    testFile = path.join(dir, "test.js");
    if (fs.existsSync(testFile)) {
      test = require(testFile); // eslint-disable-line global-require
    } else {
      test = {};
    }

    testFunc = test.check || defaultCheck;

    if (testFunc.length >= 3) {
      description += " #e2e";
    }

    it(description, function it() {
      process.chdir(dir);

      if ((!browser && testFunc.length >= 3) || (test.skip && test.skip())) {
        this.skip();
        return undefined;
      }

      return Promise.promisify(webpack)(
        merge(
          { output: { path: path.join(dir, "dist") } },
          webpackVersion >= 4 ? { mode: "production" } : {},
          require(path.join(dir, "webpack.config.js")) // eslint-disable-line global-require
        )
      ).then(stats => {
        if (stats.hasErrors()) {
          throw new Error(stats.toString({ reason: true }));
        }

        if (testFunc.length < 2) {
          return testFunc(stats);
        }

        return new Promise((resolve, reject) => {
          server = httpShutdown(
            connect()
              .use(serveStatic(path.join(dir, "dist")))
              .listen(port, () => {
                Promise.resolve(
                  testFunc(stats, `http://localhost:${port}/`, browser)
                )
                  .then(() => {
                    server.shutdown(resolve);
                  })
                  .catch(testErr => {
                    server.shutdown(() => reject(testErr));
                  });
              })
          );
        });
      });
    });
  });
});
