/**
 * Copyright (c) 2015-present, Waysact Pty Ltd
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

var webpack = require('webpack');
var Template = require('webpack/lib/Template');
var util = require('./util');

function computeSriHashes(chunk, hashFuncNames) {
  var allChunks = util.findChunks(chunk);
  var includedChunks = new Set(
    (chunk.getAllAsyncChunks
      ? Array.from(chunk.getAllAsyncChunks()).map(c => c.id)
      : Object.keys(chunk.getChunkMaps().hash)
    ).map(id => id.toString())
  );

  return Array.from(allChunks).reduce(function chunkIdReducer(
    sriHashes,
    depChunk
  ) {
    if (includedChunks.has(depChunk.id.toString())) {
      // eslint-disable-next-line no-param-reassign
      sriHashes[depChunk.id] = util.makePlaceholder(hashFuncNames, depChunk.id);
    }
    return sriHashes;
  }, {});
}

function getCompilationHooks(compilation, mainTemplate) {
  if (webpack.web &&
      webpack.web.JsonpTemplatePlugin &&
      webpack.web.JsonpTemplatePlugin.getCompilationHooks) {
    return webpack.web.JsonpTemplatePlugin.getCompilationHooks(
      compilation
    );
  }
  return mainTemplate.hooks;
}

function WebIntegrityJsonpMainTemplatePlugin(sriPlugin, compilation) {
  this.sriPlugin = sriPlugin;
  this.compilation = compilation;
}

/*
 *  Patch jsonp-script code to add the integrity attribute.
 */
WebIntegrityJsonpMainTemplatePlugin.prototype.addAttribute = function addAttribute(
  mainTemplate,
  elName,
  source,
  chunk
) {
  var hashes = computeSriHashes(chunk, this.sriPlugin.options.hashFuncNames);

  var outputOptions = this.compilation.outputOptions || mainTemplate.outputOptions;

  if (!outputOptions.crossOriginLoading) {
    this.sriPlugin.errorOnce(
      this.compilation,
      'webpack option output.crossOriginLoading not set, code splitting will not work!'
    );
  }

  return (Template.asString || mainTemplate.asString)([
    source,
    elName === "script" ? ('var sriHashes = ' + JSON.stringify(hashes) + ';') : '',
    elName + '.integrity = sriHashes[chunkId];',
    elName + '.crossOrigin = ' +
      JSON.stringify(outputOptions.crossOriginLoading) +
      ';'
  ]);
};

WebIntegrityJsonpMainTemplatePlugin.prototype.apply = function apply(
  mainTemplate
) {
  var jsonpScriptPlugin = this.addAttribute.bind(this, mainTemplate, "script");
  var linkPreloadPlugin = this.addAttribute.bind(this, mainTemplate, "link");
  var compilationHooks = getCompilationHooks(this.compilation, mainTemplate);

  if (this.compilation.compiler.options.target !== 'web') {
    this.sriPlugin.warnOnce(
      this.compilation,
      'This plugin is not useful for non-web targets.'
    );
    return;
  }

  if (!mainTemplate.hooks) {
    mainTemplate.plugin('jsonp-script', jsonpScriptPlugin);
  } else {
    compilationHooks.jsonpScript.tap('SriPlugin', jsonpScriptPlugin);
    compilationHooks.linkPreload.tap('SriPlugin', linkPreloadPlugin);
  }
};

module.exports = WebIntegrityJsonpMainTemplatePlugin;
