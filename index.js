var crypto = require('crypto');
var path = require('path');
var ReplaceSource = require('webpack-core/lib/ReplaceSource');

// https://www.w3.org/TR/2016/REC-SRI-20160623/#cryptographic-hash-functions
var standardHashFuncNames = ['sha256', 'sha384', 'sha512'];

// https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_settings_attributes
var standardCrossoriginOptions = ['crossorigin', 'anonymous'];

function makePlaceholder(id) {
  return '*-*-*-CHUNK-SRI-HASH-' + id + '-*-*-*';
}

function findDepChunks(chunk, allDepChunkIds) {
  chunk.chunks.forEach(function forEachChunk(depChunk) {
    if (!allDepChunkIds[depChunk.id]) {
      allDepChunkIds[depChunk.id] = true;
    }
    findDepChunks(depChunk, allDepChunkIds);
  });
}

function WebIntegrityJsonpMainTemplatePlugin() {}

WebIntegrityJsonpMainTemplatePlugin.prototype.apply = function apply(mainTemplate) {
  /*
   *  Patch jsonp-script code to add the integrity attribute.
   */
  mainTemplate.plugin('jsonp-script', function jsonpScriptPlugin(source) {
    return this.asString([
      source,
      'script.integrity = sriHashes[chunkId];'
    ]);
  });

  /*
   *  Patch local-vars code to add a mapping from chunk ID to SRIs.
   *  Since SRIs haven't been computed at this point, we're using
   *  magic placeholders for SRI values and going to replace them
   *  later.
   */
  mainTemplate.plugin('local-vars', function localVarsPlugin(source, chunk) {
    if (chunk.chunks.length > 0) {
      var allDepChunkIds = {};
      findDepChunks(chunk, allDepChunkIds);

      return this.asString([
        source,
        'var sriHashes = {',
        this.indent(
          Object.keys(allDepChunkIds).map(function mapChunkId(chunkId) {
            return chunkId + ':"' + makePlaceholder(chunkId) + '"';
          }).join(',\n')
        ),
        '};'
      ]);
    }
    return source;
  });
};

function SubresourceIntegrityPlugin(options) {
  var useOptions;
  if (typeof options === 'string') {
    useOptions = {
      hashFuncNames: [options],
      deprecatedOptions: true
    };
  } else if (Array.isArray(options)) {
    useOptions = {
      hashFuncNames: options,
      deprecatedOptions: true
    };
  } else if (options === null || typeof options === 'undefined') {
    useOptions = {};
  } else if (typeof options === 'object') {
    useOptions = options;
  } else {
    throw new Error('webpack-subresource-integrity: argument must be an object');
  }

  this.options = {
    enabled: true,
    crossorigin: 'anonymous'
  };

  for (var key in useOptions) {
    if (useOptions.hasOwnProperty(key)) {
      this.options[key] = useOptions[key];
    }
  }

  this.emittedWarnings = {};
}

SubresourceIntegrityPlugin.prototype.emitMessage = function emitMessage(messages, message) {
  messages.push(new Error('webpack-subresource-integrity: ' + message));
};

SubresourceIntegrityPlugin.prototype.warnOnce = function warn(compilation, message) {
  if (!this.emittedWarnings[message]) {
    this.emittedWarnings[message] = true;
    this.emitMessage(compilation.warnings, message);
  }
};

SubresourceIntegrityPlugin.prototype.error = function error(compilation, message) {
  this.emitMessage(compilation.errors, message);
};

SubresourceIntegrityPlugin.prototype.validateOptions = function validateOptions(compilation) {
  if (this.options.deprecatedOptions) {
    this.warnOnce(
      compilation,
      'Passing a string or array to the plugin constructor is deprecated. ' +
      'Support will be removed in webpack-subresource-integrity 1.0.0. ' +
      'Please update your code. ' +
        'See https://github.com/waysact/webpack-subresource-integrity/issues/18 for more information.');
  }
  if (!Array.isArray(this.options.hashFuncNames)) {
    this.error(
      compilation,
      'options.hashFuncNames must be an array of hash function names, ' +
        'instead got \'' + this.options.hashFuncNames + '\'.');
    this.options.enabled = false;
  } else {
    var foundStandardHashFunc = false;
    for (var i = 0; i < this.options.hashFuncNames.length; i++) {
      var hashFuncName = this.options.hashFuncNames[i];
      if (typeof hashFuncName !== 'string' &&
          !(hashFuncName instanceof String)) {
        this.error(
          compilation,
          'options.hashFuncNames must be an array of hash function names, ' +
            'but contained ' + hashFuncName + '.');
        this.options.enabled = false;
        return;
      }
      if (standardHashFuncNames.indexOf(hashFuncName) >= 0) {
        foundStandardHashFunc = true;
      }
    }
    if (!foundStandardHashFunc) {
      this.warnOnce(
        compilation,
        'It is recommended that at least one hash function is part of the set ' +
          'for which support is mandated by the specification. ' +
          'These are: ' + standardHashFuncNames.join(', ') + '. ' +
          'See http://www.w3.org/TR/SRI/#cryptographic-hash-functions for more information.');
    }
  }
  if (typeof this.options.crossorigin !== 'string' &&
      !(this.options.crossorigin instanceof String)) {
    this.error(
      compilation,
      'options.crossorigin must be a string.');
    this.options.enabled = false;
    return;
  }
  if (standardCrossoriginOptions.indexOf(this.options.crossorigin) < 0) {
    this.warnOnce(
      compilation,
      'You\'ve specified a value for the crossorigin option that is not part of the set of standard values. ' +
        'These are: ' + standardCrossoriginOptions.join(', ') + '. ' +
        'See https://www.w3.org/TR/SRI/#cross-origin-data-leakage for more information.');
  }
};

/*  Given a public URL path to an asset, as generated by
 *  HtmlWebpackPlugin for use as a `<script src>` or `<link href`> URL
 *  in `index.html`, return the path to the asset, suitable as a key
 *  into `compilation.assets`.
 */
SubresourceIntegrityPlugin.prototype.hwpAssetPath = function hwpAssetPath(src) {
  return path.relative(this.hwpPublicPath, src.replace(/\?[a-zA-Z0-9]+$/, ''));
};

SubresourceIntegrityPlugin.prototype.apply = function apply(compiler) {
  var self = this;

  function computeIntegrity(source) {
    return self.options.hashFuncNames.map(function mapHashFuncName(hashFuncName) {
      var hash = crypto.createHash(hashFuncName).update(source, 'utf8').digest('base64');
      return hashFuncName + '-' + hash;
    }).join(' ');
  }

  compiler.plugin('after-plugins', function afterPlugins() {
    compiler.plugin('this-compilation', function thisCompilation(compilation) {
      self.validateOptions(compilation);

      if (!self.options.enabled) {
        return;
      }

      compilation.mainTemplate.apply(new WebIntegrityJsonpMainTemplatePlugin());

      /*
       *  Calculate SRI values for each chunk and replace the magic
       *  placeholders by the actual values.
       */
      compilation.plugin('after-optimize-assets', function optimizeAssetsPlugin(assets) {
        var hashByChunkId = {};
        var visitedByChunkId = {};
        function processChunkRecursive(chunk) {
          var depChunkIds = [];

          if (visitedByChunkId[chunk.id]) {
            return [];
          }
          visitedByChunkId[chunk.id] = true;

          chunk.chunks.forEach(function mapChunk(depChunk) {
            depChunkIds = depChunkIds.concat(processChunkRecursive(depChunk));
          });

          if (chunk.files.length > 0) {
            var chunkFile = chunk.files[0];

            var oldSource = assets[chunkFile].source();

            if (oldSource.indexOf('webpackHotUpdate') >= 0) {
              self.warnOnce(
                compilation,
                'Chunks loaded by HMR are unprotected. ' +
                  'Consider disabling webpack-subresource-integrity in development mode.'
              );
            }

            var newAsset = new ReplaceSource(assets[chunkFile]);

            depChunkIds.forEach(function forEachChunk(depChunkId) {
              var magicMarker = makePlaceholder(depChunkId);
              var magicMarkerPos = oldSource.indexOf(magicMarker);
              if (magicMarkerPos >= 0) {
                newAsset.replace(
                  magicMarkerPos,
                  magicMarkerPos + magicMarker.length - 1,
                  hashByChunkId[depChunkId]);
              }
            });

            assets[chunkFile] = newAsset;

            var newSource = newAsset.source();
            hashByChunkId[chunk.id] = newAsset.integrity = computeIntegrity(newSource);
          }
          return [ chunk.id ].concat(depChunkIds);
        }

        compilation.chunks.forEach(function forEachChunk(chunk) {
          // chunk.entry was removed in Webpack 2. Use hasRuntime() for this check instead (if it exists)
          if (('hasRuntime' in chunk) ? chunk.hasRuntime() : chunk.entry) {
            processChunkRecursive(chunk);
          }
        });

        for (var key in assets) {
          if (assets.hasOwnProperty(key)) {
            var asset = assets[key];
            if (!asset.integrity) {
              asset.integrity = computeIntegrity(asset.source());
            }
          }
        }
      });

      function getTagSrc(tag) {
        // Get asset path - src from scripts and href from links
        return tag.attributes.href || tag.attributes.src;
      }

      function filterTag(tag) {
        // Process only script and link tags with a url
        return (tag.tagName === 'script' || tag.tagName === 'link') && getTagSrc(tag);
      }

      function getIntegrityChecksumForAsset(src) {
        var asset = compilation.assets[src];
        return asset && asset.integrity;
      }

      function alterAssetTags(pluginArgs, callback) {
        /* html-webpack-plugin has added an event so we can pre-process the html tags before they
           inject them. This does the work.
        */
        function processTag(tag) {
          var src = self.hwpAssetPath(getTagSrc(tag));
          var checksum = getIntegrityChecksumForAsset(src);
          if (!checksum) {
            self.warnOnce(
              compilation,
              'Cannot determine hash for asset \'' +
                src + '\', the resource will be unprotected.');
            return;
          }
          // Add integrity check sums
          tag.attributes.integrity = checksum;
          tag.attributes.crossorigin = self.options.crossorigin;
        }

        pluginArgs.head.filter(filterTag).forEach(processTag);
        pluginArgs.body.filter(filterTag).forEach(processTag);
        callback(null, pluginArgs);
      }

      /*  Add jsIntegrity and cssIntegrity properties to pluginArgs, to
       *  go along with js and css properties.  These are later
       *  accessible on `htmlWebpackPlugin.files`.
       */
      function beforeHtmlGeneration(pluginArgs, callback) {
        self.hwpPublicPath = pluginArgs.assets.publicPath;
        ['js', 'css'].forEach(function addIntegrity(fileType) {
          pluginArgs.assets[fileType + 'Integrity'] =
            pluginArgs.assets[fileType].map(function assetIntegrity(filePath) {
              var src = self.hwpAssetPath(filePath);
              return compilation.assets[src].integrity;
            });
        });
        pluginArgs.plugin.options.sriCrossOrigin = self.options.crossorigin;
        callback(null, pluginArgs);
      }

      /*
       *  html-webpack support:
       *    Modify the asset tags before webpack injects them for anything with an integrity value.
       */
      compilation.plugin('html-webpack-plugin-alter-asset-tags', alterAssetTags);
      compilation.plugin('html-webpack-plugin-before-html-generation', beforeHtmlGeneration);
    });
  });
};

module.exports = SubresourceIntegrityPlugin;
