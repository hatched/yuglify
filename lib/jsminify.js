/*
 * Copyright (c) 2011-2012, Yahoo! Inc.  All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */
/*
 * The comment/license workaround is based on the Ender workaround here:
 * https://github.com/ender-js/Ender/blob/76961673be2a29e893d8d3dc9b97e3faf8b169a6/lib/ender.file.js#L25-58
 * Ender is licensed under MIT - copyright 2012 Dustin Diaz & Jacob Thornton
 * http://ender.no.de/
*/
var uglify = require('uglify-js');

/*
  nested configs are to avoid uglify throwing an error for unsupported options

  TODO: track down the v2 equivalent to these config options
  mangle_toplevel: true,
  no_mangle_functions: true,
*/
exports.config = {
    mangle: true,
    squeeze: true,
    map: false,
    fileName: "",
    compressor: {
        hoist_vars: true
    },
    beautify: {
        max_line_len: 6000,
        semicolons: false
    }
};

exports.jsminify = function (code, config, callback) {
    if (typeof config === 'function') {
        callback = config;
        config = exports.config;
    }
    config = config || exports.config;
    var comments = [],
        token = '"yUglify: preserved comment block"',
        reMultiComments = /\/\*![\s\S]*?\*\//g,
        /*
            In some cases Uglify adds a comma, in others it doesn't
            So we have to process the tokens twice, first with the comma
            then without it to catch both cases and to be clear about it.
        */
        reTokens1 = new RegExp(token + ',', 'g'),
        reTokens = new RegExp(token, 'g'),
        ast, map, sourceMap, stream, compressor;

    try {
        code = code.replace(reMultiComments, function (comment) {
            comments.push(comment);
            return ';' + token + ';';
        });

        config.ascii_only = true; //Force ascii

        ast = uglify.parse(code, {
            filename: config.fileName
        });
        ast.figure_out_scope();

        if (config.squeeze) {
            ast.figure_out_scope();
            compressor = uglify.Compressor(config.compressor);
            ast = ast.transform(compressor);
        }
        if (config.mangle) {
            ast.figure_out_scope();
            ast.compute_char_frequency();
            ast.mangle_names();
        }
        if (config.map) {
            sourceMap = uglify.SourceMap(config.sourceMap);
            stream = uglify.OutputStream({
                source_map: sourceMap
            });
            ast.print(stream);
            map = sourceMap.toString();
        }
        code = ast.print_to_string(config.beautify);

        //First pass with comma (comment inside code somewhere)
        code = code.replace(reTokens1, function () {
            return '\n' + comments.shift() + '\n';
        });

        //Second pass without the comma to catch normal comments
        code = code.replace(reTokens, function () {
            return '\n' + comments.shift() + '\n';
        });

        if ((code.substr(code.length - 1) === ')') ||
            (code.substr(code.length - 1) === '}')) {
            code += ';';
        }

        //Trim spaces at the beginning of the code
        code = code.replace(/^\s+/, '');

        code += '\n';

        if (config.map && config.sourceMap.flag) {
            code = code + '//@ sourceMappingURL=' + config.sourceMap.mapFile;
        }

        callback(null, {
            min: code,
            map: map
        });
    } catch (e) {
        callback(e);
    }
};
