# Contributing

## Issues

If you have discovered a bug or have a feature suggestion, feel free
to create an issue on Github.

This plugin is being used in production and has a comprehensive test
suite that ensures it works in several scenarios.  If it's not working
for you, it's very likely to do with your specific Webpack
configuration.  Therefore it is important that you provide as much
information about your configuration as possible when filing a bug
report.

Ideally you can provide a small test project (as a Github repository
or Gist) that can be built to reproduce the issue.

If for some reason you can't isolate the problem in a test project, at
the very least we will need the following:

- A list of the package versions you're using, ideally as a
  `package.json` or `npm-shrinkwrap.json` file, or at least the
  version numbers for the following: Node.js, Webpack, and all Webpack
  plugins you're using (including this plugin).

- Your `webpack.config.js`, or at least the `plugins` and `output`
  sections.

- Any other information you can provide, for example how exactly you
  invoke the Webpack build process, and how exactly you embed
  integrity values in your HTML file.

Thanks for helping to improve webpack-subresource-integrity!

## Pull Requests

Pull requests are welcome!

You are welcome to correct any spelling mistakes or language issues.

For code changes, please read the following instructions to ensure
that we can accept your pull request.

### Include a new test case

Your pull request should include at least one new test case.
[Creating a new test case is easy!](examples/README.md#adding-a-test-case)

The test case should fail without your code changes.  You can ensure
this is the case as follows:

```shell
git checkout master
git checkout your-branch -- test examples
npm test # this should fail
```

### Webpack compatibility

Your new test case and all existing test cases should pass with all
major Webpack versions (currently 1.x, 2.x and 3.x).  You can ensure
this is the case as follows:

```shell
npm install webpack@1 extract-text-webpack-plugin@1 && npm test
npm install webpack@2 extract-text-webpack-plugin@2 && npm test
npm install webpack@3 extract-text-webpack-plugin@2 && npm test
```

### Code formatting

Your code should be eslint-clean.  You can ensure this is the case as
follows:

```shell
npm run lint # this should not output any errors or warnings
```
