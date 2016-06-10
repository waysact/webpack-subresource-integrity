var crypto = require('crypto');
var path = require('path');
var ReplaceSource = require('webpack-core/lib/ReplaceSource');

function makePlaceholder(id) {
  return '*-*-*-CHUNK-SRI-HASH-' + id + '-*-*-*';
}

function findDepChunks(chunk, allDepChunkIds) {
  chunk.chunks.forEach(function forEachChunk(depChunk) {
    if (!allDepChunkIds.includes(depChunk.id)) {
      allDepChunkIds.push(depChunk.id);
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
      var allDepChunkIds = [];
      findDepChunks(chunk, allDepChunkIds);

      return this.asString([
        source,
        'var sriHashes = {',
        this.indent(
          allDepChunkIds.map(function mapChunkId(chunkId) {
            return chunkId + ':"' + makePlaceholder(chunkId) + '"';
          }).join(',\n')
        ),
        '};'
      ]);
    }
    return source;
  });
};

function SubresourceIntegrityPlugin(algorithms) {
  if (typeof algorithms === 'string') {
    this.algorithms = [ algorithms ];
  } else if (!Array.isArray(algorithms)) {
    throw new Error('Expected an array of strings or a string');
  } else if (algorithms.length === 0) {
    throw new Error('Algorithms array must not be empty');
  } else {
    this.algorithms = algorithms;
  }
}


SubresourceIntegrityPlugin.prototype.apply = function apply(compiler) {
  var algorithms = this.algorithms;

  function computeIntegrity(source) {
    return algorithms.map(function mapAlgo(algo) {
      var hash = crypto.createHash(algo).update(source, 'utf8').digest('base64');
      return algo + '-' + hash;
    }).join(' ');
  }

  /* html-webpack-plugin has added an event so we can pre-process the html tags before they
   inject them. This does the work.
   */
  function processTag(tag, compilation) {
    if (!tag.attributes) return;
    var src =  tag.attributes.href; // link tags have href
    if (!src) {
      src = tag.attributes.src; // script tags have src
    }
    if (!src) {
      return;
    }
    var base = path.basename(src);
    var asset = compilation.assets[base];
    if (asset && asset.integrity) {
      tag.attributes.integrity = asset.integrity;
      tag.attributes.crossorigin = 'anonymous';
    }
  }
  function supportHtmlWebpack(compilation, pluginArgs, callback) {
    pluginArgs.head.forEach(function ptag(tag) {
      processTag(tag, compilation);
    });
    pluginArgs.body.forEach(function ptag(tag) {
      processTag(tag, compilation);
    });
    callback(null);
  }

  compiler.plugin('compilation', function compilationPlugin(compilation) {
    /*
     * Double plug-in registration in order to push our
     * plugin to the end of the plugin stack.
     */
    compiler.plugin('this-compilation', function thisCompilationPlugin(thisCompilation) {
      thisCompilation.mainTemplate.apply(new WebIntegrityJsonpMainTemplatePlugin());
    });

    /*
     *  Calculate SRI values for each chunk and replace the magic
     *  placeholders by the actual values.
     */
    compilation.plugin('optimize-assets', function optimizeAssetsPlugin(assets, callback) {
      var hashByChunkId = {};
      function processChunkRecursive(chunk) {
        var depChunkIds = [];

        chunk.chunks.forEach(function mapChunk(depChunk) {
          depChunkIds = depChunkIds.concat(processChunkRecursive(depChunk));
        });

        if (chunk.files.length > 0) {
          var chunkFile = chunk.files[0];

          var oldSource = assets[chunkFile].source();
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
        if (chunk.entry) {
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

      callback();
    });

    /*
     *  html-webpack support:
     *    Modify the asset tags before webpack injects them for anything with an integrity value.
     */
    compilation.plugin('html-webpack-plugin-alter-asset-tags', supportHtmlWebpack.bind(this, compilation));
  });
};

module.exports = SubresourceIntegrityPlugin;
