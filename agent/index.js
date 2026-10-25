// dsh-remote-agent bundle (generated). Source: src/*.ts
import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/ws/lib/constants.js
var require_constants = __commonJS({
  "node_modules/ws/lib/constants.js"(exports, module) {
    "use strict";
    var BINARY_TYPES = ["nodebuffer", "arraybuffer", "fragments"];
    var hasBlob = typeof Blob !== "undefined";
    if (hasBlob) BINARY_TYPES.push("blob");
    module.exports = {
      BINARY_TYPES,
      CLOSE_TIMEOUT: 3e4,
      EMPTY_BUFFER: Buffer.alloc(0),
      GUID: "258EAFA5-E914-47DA-95CA-C5AB0DC85B11",
      hasBlob,
      kForOnEventAttribute: Symbol("kIsForOnEventAttribute"),
      kListener: Symbol("kListener"),
      kStatusCode: Symbol("status-code"),
      kWebSocket: Symbol("websocket"),
      NOOP: () => {
      }
    };
  }
});

// node_modules/ws/lib/buffer-util.js
var require_buffer_util = __commonJS({
  "node_modules/ws/lib/buffer-util.js"(exports, module) {
    "use strict";
    var { EMPTY_BUFFER } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    function concat(list, totalLength) {
      if (list.length === 0) return EMPTY_BUFFER;
      if (list.length === 1) return list[0];
      const target = Buffer.allocUnsafe(totalLength);
      let offset = 0;
      for (let i = 0; i < list.length; i++) {
        const buf = list[i];
        target.set(buf, offset);
        offset += buf.length;
      }
      if (offset < totalLength) {
        return new FastBuffer(target.buffer, target.byteOffset, offset);
      }
      return target;
    }
    function _mask(source, mask, output, offset, length) {
      for (let i = 0; i < length; i++) {
        output[offset + i] = source[i] ^ mask[i & 3];
      }
    }
    function _unmask(buffer, mask) {
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] ^= mask[i & 3];
      }
    }
    function toArrayBuffer(buf) {
      if (buf.length === buf.buffer.byteLength) {
        return buf.buffer;
      }
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
    }
    function toBuffer(data) {
      toBuffer.readOnly = true;
      if (Buffer.isBuffer(data)) return data;
      let buf;
      if (data instanceof ArrayBuffer) {
        buf = new FastBuffer(data);
      } else if (ArrayBuffer.isView(data)) {
        buf = new FastBuffer(data.buffer, data.byteOffset, data.byteLength);
      } else {
        buf = Buffer.from(data);
        toBuffer.readOnly = false;
      }
      return buf;
    }
    module.exports = {
      concat,
      mask: _mask,
      toArrayBuffer,
      toBuffer,
      unmask: _unmask
    };
    if (!process.env.WS_NO_BUFFER_UTIL) {
      try {
        const bufferUtil = __require("bufferutil");
        module.exports.mask = function(source, mask, output, offset, length) {
          if (length < 48) _mask(source, mask, output, offset, length);
          else bufferUtil.mask(source, mask, output, offset, length);
        };
        module.exports.unmask = function(buffer, mask) {
          if (buffer.length < 32) _unmask(buffer, mask);
          else bufferUtil.unmask(buffer, mask);
        };
      } catch (e) {
      }
    }
  }
});

// node_modules/ws/lib/limiter.js
var require_limiter = __commonJS({
  "node_modules/ws/lib/limiter.js"(exports, module) {
    "use strict";
    var kDone = Symbol("kDone");
    var kRun = Symbol("kRun");
    var Limiter = class {
      /**
       * Creates a new `Limiter`.
       *
       * @param {Number} [concurrency=Infinity] The maximum number of jobs allowed
       *     to run concurrently
       */
      constructor(concurrency) {
        this[kDone] = () => {
          this.pending--;
          this[kRun]();
        };
        this.concurrency = concurrency || Infinity;
        this.jobs = [];
        this.pending = 0;
      }
      /**
       * Adds a job to the queue.
       *
       * @param {Function} job The job to run
       * @public
       */
      add(job) {
        this.jobs.push(job);
        this[kRun]();
      }
      /**
       * Removes a job from the queue and runs it if possible.
       *
       * @private
       */
      [kRun]() {
        if (this.pending === this.concurrency) return;
        if (this.jobs.length) {
          const job = this.jobs.shift();
          this.pending++;
          job(this[kDone]);
        }
      }
    };
    module.exports = Limiter;
  }
});

// node_modules/ws/lib/permessage-deflate.js
var require_permessage_deflate = __commonJS({
  "node_modules/ws/lib/permessage-deflate.js"(exports, module) {
    "use strict";
    var zlib = __require("zlib");
    var bufferUtil = require_buffer_util();
    var Limiter = require_limiter();
    var { kStatusCode } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    var TRAILER = Buffer.from([0, 0, 255, 255]);
    var kPerMessageDeflate = Symbol("permessage-deflate");
    var kTotalLength = Symbol("total-length");
    var kCallback = Symbol("callback");
    var kBuffers = Symbol("buffers");
    var kError = Symbol("error");
    var zlibLimiter;
    var PerMessageDeflate2 = class {
      /**
       * Creates a PerMessageDeflate instance.
       *
       * @param {Object} [options] Configuration options
       * @param {(Boolean|Number)} [options.clientMaxWindowBits] Advertise support
       *     for, or request, a custom client window size
       * @param {Boolean} [options.clientNoContextTakeover=false] Advertise/
       *     acknowledge disabling of client context takeover
       * @param {Number} [options.concurrencyLimit=10] The number of concurrent
       *     calls to zlib
       * @param {Boolean} [options.isServer=false] Create the instance in either
       *     server or client mode
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {(Boolean|Number)} [options.serverMaxWindowBits] Request/confirm the
       *     use of a custom server window size
       * @param {Boolean} [options.serverNoContextTakeover=false] Request/accept
       *     disabling of server context takeover
       * @param {Number} [options.threshold=1024] Size (in bytes) below which
       *     messages should not be compressed if context takeover is disabled
       * @param {Object} [options.zlibDeflateOptions] Options to pass to zlib on
       *     deflate
       * @param {Object} [options.zlibInflateOptions] Options to pass to zlib on
       *     inflate
       */
      constructor(options) {
        this._options = options || {};
        this._threshold = this._options.threshold !== void 0 ? this._options.threshold : 1024;
        this._maxPayload = this._options.maxPayload | 0;
        this._isServer = !!this._options.isServer;
        this._deflate = null;
        this._inflate = null;
        this.params = null;
        if (!zlibLimiter) {
          const concurrency = this._options.concurrencyLimit !== void 0 ? this._options.concurrencyLimit : 10;
          zlibLimiter = new Limiter(concurrency);
        }
      }
      /**
       * @type {String}
       */
      static get extensionName() {
        return "permessage-deflate";
      }
      /**
       * Create an extension negotiation offer.
       *
       * @return {Object} Extension parameters
       * @public
       */
      offer() {
        const params = {};
        if (this._options.serverNoContextTakeover) {
          params.server_no_context_takeover = true;
        }
        if (this._options.clientNoContextTakeover) {
          params.client_no_context_takeover = true;
        }
        if (this._options.serverMaxWindowBits) {
          params.server_max_window_bits = this._options.serverMaxWindowBits;
        }
        if (this._options.clientMaxWindowBits) {
          params.client_max_window_bits = this._options.clientMaxWindowBits;
        } else if (this._options.clientMaxWindowBits == null) {
          params.client_max_window_bits = true;
        }
        return params;
      }
      /**
       * Accept an extension negotiation offer/response.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Object} Accepted configuration
       * @public
       */
      accept(configurations) {
        configurations = this.normalizeParams(configurations);
        this.params = this._isServer ? this.acceptAsServer(configurations) : this.acceptAsClient(configurations);
        return this.params;
      }
      /**
       * Releases all resources used by the extension.
       *
       * @public
       */
      cleanup() {
        if (this._inflate) {
          this._inflate.close();
          this._inflate = null;
        }
        if (this._deflate) {
          const callback = this._deflate[kCallback];
          this._deflate.close();
          this._deflate = null;
          if (callback) {
            callback(
              new Error(
                "The deflate stream was closed while data was being processed"
              )
            );
          }
        }
      }
      /**
       *  Accept an extension negotiation offer.
       *
       * @param {Array} offers The extension negotiation offers
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsServer(offers) {
        const opts = this._options;
        const accepted = offers.find((params) => {
          if (opts.serverNoContextTakeover === false && params.server_no_context_takeover || params.server_max_window_bits && (opts.serverMaxWindowBits === false || typeof opts.serverMaxWindowBits === "number" && opts.serverMaxWindowBits > params.server_max_window_bits) || typeof opts.clientMaxWindowBits === "number" && (typeof params.client_max_window_bits === "number" ? opts.clientMaxWindowBits > params.client_max_window_bits : !params.client_max_window_bits)) {
            return false;
          }
          return true;
        });
        if (!accepted) {
          throw new Error("None of the extension offers can be accepted");
        }
        if (opts.serverNoContextTakeover) {
          accepted.server_no_context_takeover = true;
        }
        if (opts.clientNoContextTakeover) {
          accepted.client_no_context_takeover = true;
        }
        if (typeof opts.serverMaxWindowBits === "number") {
          accepted.server_max_window_bits = opts.serverMaxWindowBits;
        }
        if (typeof opts.clientMaxWindowBits === "number") {
          accepted.client_max_window_bits = opts.clientMaxWindowBits;
        } else if (accepted.client_max_window_bits === true || opts.clientMaxWindowBits === false) {
          delete accepted.client_max_window_bits;
        }
        return accepted;
      }
      /**
       * Accept the extension negotiation response.
       *
       * @param {Array} response The extension negotiation response
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsClient(response) {
        const params = response[0];
        if (this._options.clientNoContextTakeover === false && params.client_no_context_takeover) {
          throw new Error('Unexpected parameter "client_no_context_takeover"');
        }
        if (!params.client_max_window_bits) {
          if (typeof this._options.clientMaxWindowBits === "number") {
            params.client_max_window_bits = this._options.clientMaxWindowBits;
          }
        } else if (this._options.clientMaxWindowBits === false || typeof this._options.clientMaxWindowBits === "number" && params.client_max_window_bits > this._options.clientMaxWindowBits) {
          throw new Error(
            'Unexpected or invalid parameter "client_max_window_bits"'
          );
        }
        return params;
      }
      /**
       * Normalize parameters.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Array} The offers/response with normalized parameters
       * @private
       */
      normalizeParams(configurations) {
        configurations.forEach((params) => {
          Object.keys(params).forEach((key) => {
            let value = params[key];
            if (value.length > 1) {
              throw new Error(`Parameter "${key}" must have only a single value`);
            }
            value = value[0];
            if (key === "client_max_window_bits") {
              if (value !== true) {
                const num = +value;
                if (!Number.isInteger(num) || num < 8 || num > 15) {
                  throw new TypeError(
                    `Invalid value for parameter "${key}": ${value}`
                  );
                }
                value = num;
              } else if (!this._isServer) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else if (key === "server_max_window_bits") {
              const num = +value;
              if (!Number.isInteger(num) || num < 8 || num > 15) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
              value = num;
            } else if (key === "client_no_context_takeover" || key === "server_no_context_takeover") {
              if (value !== true) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else {
              throw new Error(`Unknown parameter "${key}"`);
            }
            params[key] = value;
          });
        });
        return configurations;
      }
      /**
       * Decompress data. Concurrency limited.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      decompress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._decompress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Compress data. Concurrency limited.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      compress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._compress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Decompress data.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _decompress(data, fin, callback) {
        const endpoint = this._isServer ? "client" : "server";
        if (!this._inflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._inflate = zlib.createInflateRaw({
            ...this._options.zlibInflateOptions,
            windowBits
          });
          this._inflate[kPerMessageDeflate] = this;
          this._inflate[kTotalLength] = 0;
          this._inflate[kBuffers] = [];
          this._inflate.on("error", inflateOnError);
          this._inflate.on("data", inflateOnData);
        }
        this._inflate[kCallback] = callback;
        this._inflate.write(data);
        if (fin) this._inflate.write(TRAILER);
        this._inflate.flush(() => {
          const err = this._inflate[kError];
          if (err) {
            this._inflate.close();
            this._inflate = null;
            callback(err);
            return;
          }
          const data2 = bufferUtil.concat(
            this._inflate[kBuffers],
            this._inflate[kTotalLength]
          );
          if (this._inflate._readableState.endEmitted) {
            this._inflate.close();
            this._inflate = null;
          } else {
            this._inflate[kTotalLength] = 0;
            this._inflate[kBuffers] = [];
            if (fin && this.params[`${endpoint}_no_context_takeover`]) {
              this._inflate.reset();
            }
          }
          callback(null, data2);
        });
      }
      /**
       * Compress data.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _compress(data, fin, callback) {
        const endpoint = this._isServer ? "server" : "client";
        if (!this._deflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._deflate = zlib.createDeflateRaw({
            ...this._options.zlibDeflateOptions,
            windowBits
          });
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          this._deflate.on("data", deflateOnData);
        }
        this._deflate[kCallback] = callback;
        this._deflate.write(data);
        this._deflate.flush(zlib.Z_SYNC_FLUSH, () => {
          if (!this._deflate) {
            return;
          }
          let data2 = bufferUtil.concat(
            this._deflate[kBuffers],
            this._deflate[kTotalLength]
          );
          if (fin) {
            data2 = new FastBuffer(data2.buffer, data2.byteOffset, data2.length - 4);
          }
          this._deflate[kCallback] = null;
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          if (fin && this.params[`${endpoint}_no_context_takeover`]) {
            this._deflate.reset();
          }
          callback(null, data2);
        });
      }
    };
    module.exports = PerMessageDeflate2;
    function deflateOnData(chunk) {
      this[kBuffers].push(chunk);
      this[kTotalLength] += chunk.length;
    }
    function inflateOnData(chunk) {
      this[kTotalLength] += chunk.length;
      if (this[kPerMessageDeflate]._maxPayload < 1 || this[kTotalLength] <= this[kPerMessageDeflate]._maxPayload) {
        this[kBuffers].push(chunk);
        return;
      }
      this[kError] = new RangeError("Max payload size exceeded");
      this[kError].code = "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH";
      this[kError][kStatusCode] = 1009;
      this.removeListener("data", inflateOnData);
      this.reset();
    }
    function inflateOnError(err) {
      this[kPerMessageDeflate]._inflate = null;
      if (this[kError]) {
        this[kCallback](this[kError]);
        return;
      }
      err[kStatusCode] = 1007;
      this[kCallback](err);
    }
  }
});

// node_modules/ws/lib/validation.js
var require_validation = __commonJS({
  "node_modules/ws/lib/validation.js"(exports, module) {
    "use strict";
    var { isUtf8 } = __require("buffer");
    var { hasBlob } = require_constants();
    var tokenChars = [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 0 - 15
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 16 - 31
      0,
      1,
      0,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      1,
      1,
      0,
      1,
      1,
      0,
      // 32 - 47
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      // 48 - 63
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 64 - 79
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      1,
      1,
      // 80 - 95
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 96 - 111
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      1,
      0,
      1,
      0
      // 112 - 127
    ];
    function isValidStatusCode(code) {
      return code >= 1e3 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006 || code >= 3e3 && code <= 4999;
    }
    function _isValidUTF8(buf) {
      const len = buf.length;
      let i = 0;
      while (i < len) {
        if ((buf[i] & 128) === 0) {
          i++;
        } else if ((buf[i] & 224) === 192) {
          if (i + 1 === len || (buf[i + 1] & 192) !== 128 || (buf[i] & 254) === 192) {
            return false;
          }
          i += 2;
        } else if ((buf[i] & 240) === 224) {
          if (i + 2 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || buf[i] === 224 && (buf[i + 1] & 224) === 128 || // Overlong
          buf[i] === 237 && (buf[i + 1] & 224) === 160) {
            return false;
          }
          i += 3;
        } else if ((buf[i] & 248) === 240) {
          if (i + 3 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || (buf[i + 3] & 192) !== 128 || buf[i] === 240 && (buf[i + 1] & 240) === 128 || // Overlong
          buf[i] === 244 && buf[i + 1] > 143 || buf[i] > 244) {
            return false;
          }
          i += 4;
        } else {
          return false;
        }
      }
      return true;
    }
    function isBlob(value) {
      return hasBlob && typeof value === "object" && typeof value.arrayBuffer === "function" && typeof value.type === "string" && typeof value.stream === "function" && (value[Symbol.toStringTag] === "Blob" || value[Symbol.toStringTag] === "File");
    }
    module.exports = {
      isBlob,
      isValidStatusCode,
      isValidUTF8: _isValidUTF8,
      tokenChars
    };
    if (isUtf8) {
      module.exports.isValidUTF8 = function(buf) {
        return buf.length < 24 ? _isValidUTF8(buf) : isUtf8(buf);
      };
    } else if (!process.env.WS_NO_UTF_8_VALIDATE) {
      try {
        const isValidUTF8 = __require("utf-8-validate");
        module.exports.isValidUTF8 = function(buf) {
          return buf.length < 32 ? _isValidUTF8(buf) : isValidUTF8(buf);
        };
      } catch (e) {
      }
    }
  }
});

// node_modules/ws/lib/receiver.js
var require_receiver = __commonJS({
  "node_modules/ws/lib/receiver.js"(exports, module) {
    "use strict";
    var { Writable } = __require("stream");
    var PerMessageDeflate2 = require_permessage_deflate();
    var {
      BINARY_TYPES,
      EMPTY_BUFFER,
      kStatusCode,
      kWebSocket
    } = require_constants();
    var { concat, toArrayBuffer, unmask } = require_buffer_util();
    var { isValidStatusCode, isValidUTF8 } = require_validation();
    var FastBuffer = Buffer[Symbol.species];
    var GET_INFO = 0;
    var GET_PAYLOAD_LENGTH_16 = 1;
    var GET_PAYLOAD_LENGTH_64 = 2;
    var GET_MASK = 3;
    var GET_DATA = 4;
    var INFLATING = 5;
    var DEFER_EVENT = 6;
    var Receiver2 = class extends Writable {
      /**
       * Creates a Receiver instance.
       *
       * @param {Object} [options] Options object
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {String} [options.binaryType=nodebuffer] The type for binary data
       * @param {Object} [options.extensions] An object containing the negotiated
       *     extensions
       * @param {Boolean} [options.isServer=false] Specifies whether to operate in
       *     client or server mode
       * @param {Number} [options.maxBufferedChunks=0] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=0] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       */
      constructor(options = {}) {
        super();
        this._allowSynchronousEvents = options.allowSynchronousEvents !== void 0 ? options.allowSynchronousEvents : true;
        this._binaryType = options.binaryType || BINARY_TYPES[0];
        this._extensions = options.extensions || {};
        this._isServer = !!options.isServer;
        this._maxBufferedChunks = options.maxBufferedChunks | 0;
        this._maxFragments = options.maxFragments | 0;
        this._maxPayload = options.maxPayload | 0;
        this._skipUTF8Validation = !!options.skipUTF8Validation;
        this[kWebSocket] = void 0;
        this._bufferedBytes = 0;
        this._buffers = [];
        this._compressed = false;
        this._payloadLength = 0;
        this._mask = void 0;
        this._fragmented = 0;
        this._masked = false;
        this._fin = false;
        this._opcode = 0;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._numFragments = 0;
        this._fragments = [];
        this._errored = false;
        this._loop = false;
        this._state = GET_INFO;
      }
      /**
       * Implements `Writable.prototype._write()`.
       *
       * @param {Buffer} chunk The chunk of data to write
       * @param {String} encoding The character encoding of `chunk`
       * @param {Function} cb Callback
       * @private
       */
      _write(chunk, encoding, cb) {
        if (this._opcode === 8 && this._state == GET_INFO) return cb();
        if (this._maxBufferedChunks > 0 && this._buffers.length >= this._maxBufferedChunks) {
          cb(
            this.createError(
              RangeError,
              "Too many buffered chunks",
              false,
              1008,
              "WS_ERR_TOO_MANY_BUFFERED_PARTS"
            )
          );
          return;
        }
        this._bufferedBytes += chunk.length;
        this._buffers.push(chunk);
        this.startLoop(cb);
      }
      /**
       * Consumes `n` bytes from the buffered data.
       *
       * @param {Number} n The number of bytes to consume
       * @return {Buffer} The consumed bytes
       * @private
       */
      consume(n) {
        this._bufferedBytes -= n;
        if (n === this._buffers[0].length) return this._buffers.shift();
        if (n < this._buffers[0].length) {
          const buf = this._buffers[0];
          this._buffers[0] = new FastBuffer(
            buf.buffer,
            buf.byteOffset + n,
            buf.length - n
          );
          return new FastBuffer(buf.buffer, buf.byteOffset, n);
        }
        const dst = Buffer.allocUnsafe(n);
        do {
          const buf = this._buffers[0];
          const offset = dst.length - n;
          if (n >= buf.length) {
            dst.set(this._buffers.shift(), offset);
          } else {
            dst.set(new Uint8Array(buf.buffer, buf.byteOffset, n), offset);
            this._buffers[0] = new FastBuffer(
              buf.buffer,
              buf.byteOffset + n,
              buf.length - n
            );
          }
          n -= buf.length;
        } while (n > 0);
        return dst;
      }
      /**
       * Starts the parsing loop.
       *
       * @param {Function} cb Callback
       * @private
       */
      startLoop(cb) {
        this._loop = true;
        do {
          switch (this._state) {
            case GET_INFO:
              this.getInfo(cb);
              break;
            case GET_PAYLOAD_LENGTH_16:
              this.getPayloadLength16(cb);
              break;
            case GET_PAYLOAD_LENGTH_64:
              this.getPayloadLength64(cb);
              break;
            case GET_MASK:
              this.getMask();
              break;
            case GET_DATA:
              this.getData(cb);
              break;
            case INFLATING:
            case DEFER_EVENT:
              this._loop = false;
              return;
          }
        } while (this._loop);
        if (!this._errored) cb();
      }
      /**
       * Reads the first two bytes of a frame.
       *
       * @param {Function} cb Callback
       * @private
       */
      getInfo(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        const buf = this.consume(2);
        if ((buf[0] & 48) !== 0) {
          const error = this.createError(
            RangeError,
            "RSV2 and RSV3 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_2_3"
          );
          cb(error);
          return;
        }
        const compressed = (buf[0] & 64) === 64;
        if (compressed && !this._extensions[PerMessageDeflate2.extensionName]) {
          const error = this.createError(
            RangeError,
            "RSV1 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_1"
          );
          cb(error);
          return;
        }
        this._fin = (buf[0] & 128) === 128;
        this._opcode = buf[0] & 15;
        this._payloadLength = buf[1] & 127;
        if (this._opcode === 0) {
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (!this._fragmented) {
            const error = this.createError(
              RangeError,
              "invalid opcode 0",
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._opcode = this._fragmented;
        } else if (this._opcode === 1 || this._opcode === 2) {
          if (this._fragmented) {
            const error = this.createError(
              RangeError,
              `invalid opcode ${this._opcode}`,
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._compressed = compressed;
        } else if (this._opcode > 7 && this._opcode < 11) {
          if (!this._fin) {
            const error = this.createError(
              RangeError,
              "FIN must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_FIN"
            );
            cb(error);
            return;
          }
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (this._payloadLength > 125 || this._opcode === 8 && this._payloadLength === 1) {
            const error = this.createError(
              RangeError,
              `invalid payload length ${this._payloadLength}`,
              true,
              1002,
              "WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH"
            );
            cb(error);
            return;
          }
        } else {
          const error = this.createError(
            RangeError,
            `invalid opcode ${this._opcode}`,
            true,
            1002,
            "WS_ERR_INVALID_OPCODE"
          );
          cb(error);
          return;
        }
        if (!this._fin && !this._fragmented) this._fragmented = this._opcode;
        this._masked = (buf[1] & 128) === 128;
        if (this._isServer) {
          if (!this._masked) {
            const error = this.createError(
              RangeError,
              "MASK must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_MASK"
            );
            cb(error);
            return;
          }
        } else if (this._masked) {
          const error = this.createError(
            RangeError,
            "MASK must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_MASK"
          );
          cb(error);
          return;
        }
        if (this._payloadLength === 126) this._state = GET_PAYLOAD_LENGTH_16;
        else if (this._payloadLength === 127) this._state = GET_PAYLOAD_LENGTH_64;
        else this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+16).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength16(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        this._payloadLength = this.consume(2).readUInt16BE(0);
        this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+64).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength64(cb) {
        if (this._bufferedBytes < 8) {
          this._loop = false;
          return;
        }
        const buf = this.consume(8);
        const num = buf.readUInt32BE(0);
        if (num > Math.pow(2, 53 - 32) - 1) {
          const error = this.createError(
            RangeError,
            "Unsupported WebSocket frame: payload length > 2^53 - 1",
            false,
            1009,
            "WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH"
          );
          cb(error);
          return;
        }
        this._payloadLength = num * Math.pow(2, 32) + buf.readUInt32BE(4);
        this.haveLength(cb);
      }
      /**
       * Payload length has been read.
       *
       * @param {Function} cb Callback
       * @private
       */
      haveLength(cb) {
        if (this._payloadLength && this._opcode < 8) {
          this._totalPayloadLength += this._payloadLength;
          if (this._totalPayloadLength > this._maxPayload && this._maxPayload > 0) {
            const error = this.createError(
              RangeError,
              "Max payload size exceeded",
              false,
              1009,
              "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
            );
            cb(error);
            return;
          }
        }
        if (this._masked) this._state = GET_MASK;
        else this._state = GET_DATA;
      }
      /**
       * Reads mask bytes.
       *
       * @private
       */
      getMask() {
        if (this._bufferedBytes < 4) {
          this._loop = false;
          return;
        }
        this._mask = this.consume(4);
        this._state = GET_DATA;
      }
      /**
       * Reads data bytes.
       *
       * @param {Function} cb Callback
       * @private
       */
      getData(cb) {
        let data = EMPTY_BUFFER;
        if (this._payloadLength) {
          if (this._bufferedBytes < this._payloadLength) {
            this._loop = false;
            return;
          }
          data = this.consume(this._payloadLength);
          if (this._masked && (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) !== 0) {
            unmask(data, this._mask);
          }
        }
        if (this._opcode > 7) {
          this.controlMessage(data, cb);
          return;
        }
        if (this._maxFragments > 0 && ++this._numFragments > this._maxFragments) {
          const error = this.createError(
            RangeError,
            "Too many message fragments",
            false,
            1008,
            "WS_ERR_TOO_MANY_BUFFERED_PARTS"
          );
          cb(error);
          return;
        }
        if (this._compressed) {
          this._state = INFLATING;
          this.decompress(data, cb);
          return;
        }
        if (data.length) {
          this._messageLength = this._totalPayloadLength;
          this._fragments.push(data);
        }
        this.dataMessage(cb);
      }
      /**
       * Decompresses data.
       *
       * @param {Buffer} data Compressed data
       * @param {Function} cb Callback
       * @private
       */
      decompress(data, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        perMessageDeflate.decompress(data, this._fin, (err, buf) => {
          if (err) return cb(err);
          if (buf.length) {
            this._messageLength += buf.length;
            if (this._messageLength > this._maxPayload && this._maxPayload > 0) {
              const error = this.createError(
                RangeError,
                "Max payload size exceeded",
                false,
                1009,
                "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
              );
              cb(error);
              return;
            }
            this._fragments.push(buf);
          }
          this.dataMessage(cb);
          if (this._state === GET_INFO) this.startLoop(cb);
        });
      }
      /**
       * Handles a data message.
       *
       * @param {Function} cb Callback
       * @private
       */
      dataMessage(cb) {
        if (!this._fin) {
          this._state = GET_INFO;
          return;
        }
        const messageLength = this._messageLength;
        const fragments = this._fragments;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._fragmented = 0;
        this._numFragments = 0;
        this._fragments = [];
        if (this._opcode === 2) {
          let data;
          if (this._binaryType === "nodebuffer") {
            data = concat(fragments, messageLength);
          } else if (this._binaryType === "arraybuffer") {
            data = toArrayBuffer(concat(fragments, messageLength));
          } else if (this._binaryType === "blob") {
            data = new Blob(fragments);
          } else {
            data = fragments;
          }
          if (this._allowSynchronousEvents) {
            this.emit("message", data, true);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", data, true);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        } else {
          const buf = concat(fragments, messageLength);
          if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
            const error = this.createError(
              Error,
              "invalid UTF-8 sequence",
              true,
              1007,
              "WS_ERR_INVALID_UTF8"
            );
            cb(error);
            return;
          }
          if (this._state === INFLATING || this._allowSynchronousEvents) {
            this.emit("message", buf, false);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", buf, false);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        }
      }
      /**
       * Handles a control message.
       *
       * @param {Buffer} data Data to handle
       * @return {(Error|RangeError|undefined)} A possible error
       * @private
       */
      controlMessage(data, cb) {
        if (this._opcode === 8) {
          if (data.length === 0) {
            this._loop = false;
            this.emit("conclude", 1005, EMPTY_BUFFER);
            this.end();
          } else {
            const code = data.readUInt16BE(0);
            if (!isValidStatusCode(code)) {
              const error = this.createError(
                RangeError,
                `invalid status code ${code}`,
                true,
                1002,
                "WS_ERR_INVALID_CLOSE_CODE"
              );
              cb(error);
              return;
            }
            const buf = new FastBuffer(
              data.buffer,
              data.byteOffset + 2,
              data.length - 2
            );
            if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
              const error = this.createError(
                Error,
                "invalid UTF-8 sequence",
                true,
                1007,
                "WS_ERR_INVALID_UTF8"
              );
              cb(error);
              return;
            }
            this._loop = false;
            this.emit("conclude", code, buf);
            this.end();
          }
          this._state = GET_INFO;
          return;
        }
        if (this._allowSynchronousEvents) {
          this.emit(this._opcode === 9 ? "ping" : "pong", data);
          this._state = GET_INFO;
        } else {
          this._state = DEFER_EVENT;
          setImmediate(() => {
            this.emit(this._opcode === 9 ? "ping" : "pong", data);
            this._state = GET_INFO;
            this.startLoop(cb);
          });
        }
      }
      /**
       * Builds an error object.
       *
       * @param {function(new:Error|RangeError)} ErrorCtor The error constructor
       * @param {String} message The error message
       * @param {Boolean} prefix Specifies whether or not to add a default prefix to
       *     `message`
       * @param {Number} statusCode The status code
       * @param {String} errorCode The exposed error code
       * @return {(Error|RangeError)} The error
       * @private
       */
      createError(ErrorCtor, message, prefix, statusCode, errorCode) {
        this._loop = false;
        this._errored = true;
        const err = new ErrorCtor(
          prefix ? `Invalid WebSocket frame: ${message}` : message
        );
        Error.captureStackTrace(err, this.createError);
        err.code = errorCode;
        err[kStatusCode] = statusCode;
        return err;
      }
    };
    module.exports = Receiver2;
  }
});

// node_modules/ws/lib/sender.js
var require_sender = __commonJS({
  "node_modules/ws/lib/sender.js"(exports, module) {
    "use strict";
    var { Duplex: Duplex2 } = __require("stream");
    var { randomFillSync } = __require("crypto");
    var {
      types: { isUint8Array }
    } = __require("util");
    var PerMessageDeflate2 = require_permessage_deflate();
    var { EMPTY_BUFFER, kWebSocket, NOOP } = require_constants();
    var { isBlob, isValidStatusCode } = require_validation();
    var { mask: applyMask, toBuffer } = require_buffer_util();
    var kByteLength = Symbol("kByteLength");
    var maskBuffer = Buffer.alloc(4);
    var RANDOM_POOL_SIZE = 8 * 1024;
    var randomPool;
    var randomPoolPointer = RANDOM_POOL_SIZE;
    var DEFAULT = 0;
    var DEFLATING = 1;
    var GET_BLOB_DATA = 2;
    var Sender2 = class _Sender {
      /**
       * Creates a Sender instance.
       *
       * @param {Duplex} socket The connection socket
       * @param {Object} [extensions] An object containing the negotiated extensions
       * @param {Function} [generateMask] The function used to generate the masking
       *     key
       */
      constructor(socket, extensions, generateMask) {
        this._extensions = extensions || {};
        if (generateMask) {
          this._generateMask = generateMask;
          this._maskBuffer = Buffer.alloc(4);
        }
        this._socket = socket;
        this._firstFragment = true;
        this._compress = false;
        this._bufferedBytes = 0;
        this._queue = [];
        this._state = DEFAULT;
        this.onerror = NOOP;
        this[kWebSocket] = void 0;
      }
      /**
       * Frames a piece of data according to the HyBi WebSocket protocol.
       *
       * @param {(Buffer|String)} data The data to frame
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @return {(Buffer|String)[]} The framed data
       * @public
       */
      static frame(data, options) {
        let mask;
        let merge = false;
        let offset = 2;
        let skipMasking = false;
        if (options.mask) {
          mask = options.maskBuffer || maskBuffer;
          if (options.generateMask) {
            options.generateMask(mask);
          } else {
            if (randomPoolPointer === RANDOM_POOL_SIZE) {
              if (randomPool === void 0) {
                randomPool = Buffer.alloc(RANDOM_POOL_SIZE);
              }
              randomFillSync(randomPool, 0, RANDOM_POOL_SIZE);
              randomPoolPointer = 0;
            }
            mask[0] = randomPool[randomPoolPointer++];
            mask[1] = randomPool[randomPoolPointer++];
            mask[2] = randomPool[randomPoolPointer++];
            mask[3] = randomPool[randomPoolPointer++];
          }
          skipMasking = (mask[0] | mask[1] | mask[2] | mask[3]) === 0;
          offset = 6;
        }
        let dataLength;
        if (typeof data === "string") {
          if ((!options.mask || skipMasking) && options[kByteLength] !== void 0) {
            dataLength = options[kByteLength];
          } else {
            data = Buffer.from(data);
            dataLength = data.length;
          }
        } else {
          dataLength = data.length;
          merge = options.mask && options.readOnly && !skipMasking;
        }
        let payloadLength = dataLength;
        if (dataLength >= 65536) {
          offset += 8;
          payloadLength = 127;
        } else if (dataLength > 125) {
          offset += 2;
          payloadLength = 126;
        }
        const target = Buffer.allocUnsafe(merge ? dataLength + offset : offset);
        target[0] = options.fin ? options.opcode | 128 : options.opcode;
        if (options.rsv1) target[0] |= 64;
        target[1] = payloadLength;
        if (payloadLength === 126) {
          target.writeUInt16BE(dataLength, 2);
        } else if (payloadLength === 127) {
          target[2] = target[3] = 0;
          target.writeUIntBE(dataLength, 4, 6);
        }
        if (!options.mask) return [target, data];
        target[1] |= 128;
        target[offset - 4] = mask[0];
        target[offset - 3] = mask[1];
        target[offset - 2] = mask[2];
        target[offset - 1] = mask[3];
        if (skipMasking) return [target, data];
        if (merge) {
          applyMask(data, mask, target, offset, dataLength);
          return [target];
        }
        applyMask(data, mask, data, 0, dataLength);
        return [target, data];
      }
      /**
       * Sends a close message to the other peer.
       *
       * @param {Number} [code] The status code component of the body
       * @param {(String|Buffer)} [data] The message component of the body
       * @param {Boolean} [mask=false] Specifies whether or not to mask the message
       * @param {Function} [cb] Callback
       * @public
       */
      close(code, data, mask, cb) {
        let buf;
        if (code === void 0) {
          buf = EMPTY_BUFFER;
        } else if (typeof code !== "number" || !isValidStatusCode(code)) {
          throw new TypeError("First argument must be a valid error code number");
        } else if (data === void 0 || !data.length) {
          buf = Buffer.allocUnsafe(2);
          buf.writeUInt16BE(code, 0);
        } else {
          const length = Buffer.byteLength(data);
          if (length > 123) {
            throw new RangeError("The message must not be greater than 123 bytes");
          }
          buf = Buffer.allocUnsafe(2 + length);
          buf.writeUInt16BE(code, 0);
          if (typeof data === "string") {
            buf.write(data, 2);
          } else if (isUint8Array(data)) {
            buf.set(data, 2);
          } else {
            throw new TypeError("Second argument must be a string or a Uint8Array");
          }
        }
        const options = {
          [kByteLength]: buf.length,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 8,
          readOnly: false,
          rsv1: false
        };
        if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, buf, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(buf, options), cb);
        }
      }
      /**
       * Sends a ping message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      ping(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 9,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a pong message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      pong(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 10,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a data message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Object} options Options object
       * @param {Boolean} [options.binary=false] Specifies whether `data` is binary
       *     or text
       * @param {Boolean} [options.compress=false] Specifies whether or not to
       *     compress `data`
       * @param {Boolean} [options.fin=false] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Function} [cb] Callback
       * @public
       */
      send(data, options, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        let opcode = options.binary ? 2 : 1;
        let rsv1 = options.compress;
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (this._firstFragment) {
          this._firstFragment = false;
          if (rsv1 && perMessageDeflate && perMessageDeflate.params[perMessageDeflate._isServer ? "server_no_context_takeover" : "client_no_context_takeover"]) {
            rsv1 = byteLength >= perMessageDeflate._threshold;
          }
          this._compress = rsv1;
        } else {
          rsv1 = false;
          opcode = 0;
        }
        if (options.fin) this._firstFragment = true;
        const opts = {
          [kByteLength]: byteLength,
          fin: options.fin,
          generateMask: this._generateMask,
          mask: options.mask,
          maskBuffer: this._maskBuffer,
          opcode,
          readOnly,
          rsv1
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, this._compress, opts, cb]);
          } else {
            this.getBlobData(data, this._compress, opts, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, this._compress, opts, cb]);
        } else {
          this.dispatch(data, this._compress, opts, cb);
        }
      }
      /**
       * Gets the contents of a blob as binary data.
       *
       * @param {Blob} blob The blob
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     the data
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      getBlobData(blob, compress, options, cb) {
        this._bufferedBytes += options[kByteLength];
        this._state = GET_BLOB_DATA;
        blob.arrayBuffer().then((arrayBuffer) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while the blob was being read"
            );
            process.nextTick(callCallbacks, this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          const data = toBuffer(arrayBuffer);
          if (!compress) {
            this._state = DEFAULT;
            this.sendFrame(_Sender.frame(data, options), cb);
            this.dequeue();
          } else {
            this.dispatch(data, compress, options, cb);
          }
        }).catch((err) => {
          process.nextTick(onError, this, err, cb);
        });
      }
      /**
       * Dispatches a message.
       *
       * @param {(Buffer|String)} data The message to send
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     `data`
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      dispatch(data, compress, options, cb) {
        if (!compress) {
          this.sendFrame(_Sender.frame(data, options), cb);
          return;
        }
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        this._bufferedBytes += options[kByteLength];
        this._state = DEFLATING;
        perMessageDeflate.compress(data, options.fin, (_, buf) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while data was being compressed"
            );
            callCallbacks(this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          this._state = DEFAULT;
          options.readOnly = false;
          this.sendFrame(_Sender.frame(buf, options), cb);
          this.dequeue();
        });
      }
      /**
       * Executes queued send operations.
       *
       * @private
       */
      dequeue() {
        while (this._state === DEFAULT && this._queue.length) {
          const params = this._queue.shift();
          this._bufferedBytes -= params[3][kByteLength];
          Reflect.apply(params[0], this, params.slice(1));
        }
      }
      /**
       * Enqueues a send operation.
       *
       * @param {Array} params Send operation parameters.
       * @private
       */
      enqueue(params) {
        this._bufferedBytes += params[3][kByteLength];
        this._queue.push(params);
      }
      /**
       * Sends a frame.
       *
       * @param {(Buffer | String)[]} list The frame to send
       * @param {Function} [cb] Callback
       * @private
       */
      sendFrame(list, cb) {
        if (list.length === 2) {
          this._socket.cork();
          this._socket.write(list[0]);
          this._socket.write(list[1], cb);
          this._socket.uncork();
        } else {
          this._socket.write(list[0], cb);
        }
      }
    };
    module.exports = Sender2;
    function callCallbacks(sender, err, cb) {
      if (typeof cb === "function") cb(err);
      for (let i = 0; i < sender._queue.length; i++) {
        const params = sender._queue[i];
        const callback = params[params.length - 1];
        if (typeof callback === "function") callback(err);
      }
    }
    function onError(sender, err, cb) {
      callCallbacks(sender, err, cb);
      sender.onerror(err);
    }
  }
});

// node_modules/ws/lib/event-target.js
var require_event_target = __commonJS({
  "node_modules/ws/lib/event-target.js"(exports, module) {
    "use strict";
    var { kForOnEventAttribute, kListener } = require_constants();
    var kCode = Symbol("kCode");
    var kData = Symbol("kData");
    var kError = Symbol("kError");
    var kMessage = Symbol("kMessage");
    var kReason = Symbol("kReason");
    var kTarget = Symbol("kTarget");
    var kType = Symbol("kType");
    var kWasClean = Symbol("kWasClean");
    var Event = class {
      /**
       * Create a new `Event`.
       *
       * @param {String} type The name of the event
       * @throws {TypeError} If the `type` argument is not specified
       */
      constructor(type) {
        this[kTarget] = null;
        this[kType] = type;
      }
      /**
       * @type {*}
       */
      get target() {
        return this[kTarget];
      }
      /**
       * @type {String}
       */
      get type() {
        return this[kType];
      }
    };
    Object.defineProperty(Event.prototype, "target", { enumerable: true });
    Object.defineProperty(Event.prototype, "type", { enumerable: true });
    var CloseEvent = class extends Event {
      /**
       * Create a new `CloseEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {Number} [options.code=0] The status code explaining why the
       *     connection was closed
       * @param {String} [options.reason=''] A human-readable string explaining why
       *     the connection was closed
       * @param {Boolean} [options.wasClean=false] Indicates whether or not the
       *     connection was cleanly closed
       */
      constructor(type, options = {}) {
        super(type);
        this[kCode] = options.code === void 0 ? 0 : options.code;
        this[kReason] = options.reason === void 0 ? "" : options.reason;
        this[kWasClean] = options.wasClean === void 0 ? false : options.wasClean;
      }
      /**
       * @type {Number}
       */
      get code() {
        return this[kCode];
      }
      /**
       * @type {String}
       */
      get reason() {
        return this[kReason];
      }
      /**
       * @type {Boolean}
       */
      get wasClean() {
        return this[kWasClean];
      }
    };
    Object.defineProperty(CloseEvent.prototype, "code", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "reason", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "wasClean", { enumerable: true });
    var ErrorEvent = class extends Event {
      /**
       * Create a new `ErrorEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.error=null] The error that generated this event
       * @param {String} [options.message=''] The error message
       */
      constructor(type, options = {}) {
        super(type);
        this[kError] = options.error === void 0 ? null : options.error;
        this[kMessage] = options.message === void 0 ? "" : options.message;
      }
      /**
       * @type {*}
       */
      get error() {
        return this[kError];
      }
      /**
       * @type {String}
       */
      get message() {
        return this[kMessage];
      }
    };
    Object.defineProperty(ErrorEvent.prototype, "error", { enumerable: true });
    Object.defineProperty(ErrorEvent.prototype, "message", { enumerable: true });
    var MessageEvent = class extends Event {
      /**
       * Create a new `MessageEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.data=null] The message content
       */
      constructor(type, options = {}) {
        super(type);
        this[kData] = options.data === void 0 ? null : options.data;
      }
      /**
       * @type {*}
       */
      get data() {
        return this[kData];
      }
    };
    Object.defineProperty(MessageEvent.prototype, "data", { enumerable: true });
    var EventTarget = {
      /**
       * Register an event listener.
       *
       * @param {String} type A string representing the event type to listen for
       * @param {(Function|Object)} handler The listener to add
       * @param {Object} [options] An options object specifies characteristics about
       *     the event listener
       * @param {Boolean} [options.once=false] A `Boolean` indicating that the
       *     listener should be invoked at most once after being added. If `true`,
       *     the listener would be automatically removed when invoked.
       * @public
       */
      addEventListener(type, handler, options = {}) {
        for (const listener of this.listeners(type)) {
          if (!options[kForOnEventAttribute] && listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            return;
          }
        }
        let wrapper;
        if (type === "message") {
          wrapper = function onMessage(data, isBinary) {
            const event = new MessageEvent("message", {
              data: isBinary ? data : data.toString()
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "close") {
          wrapper = function onClose(code, message) {
            const event = new CloseEvent("close", {
              code,
              reason: message.toString(),
              wasClean: this._closeFrameReceived && this._closeFrameSent
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "error") {
          wrapper = function onError(error) {
            const event = new ErrorEvent("error", {
              error,
              message: error.message
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "open") {
          wrapper = function onOpen() {
            const event = new Event("open");
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else {
          return;
        }
        wrapper[kForOnEventAttribute] = !!options[kForOnEventAttribute];
        wrapper[kListener] = handler;
        if (options.once) {
          this.once(type, wrapper);
        } else {
          this.on(type, wrapper);
        }
      },
      /**
       * Remove an event listener.
       *
       * @param {String} type A string representing the event type to remove
       * @param {(Function|Object)} handler The listener to remove
       * @public
       */
      removeEventListener(type, handler) {
        for (const listener of this.listeners(type)) {
          if (listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            this.removeListener(type, listener);
            break;
          }
        }
      }
    };
    module.exports = {
      CloseEvent,
      ErrorEvent,
      Event,
      EventTarget,
      MessageEvent
    };
    function callListener(listener, thisArg, event) {
      if (typeof listener === "object" && listener.handleEvent) {
        listener.handleEvent.call(listener, event);
      } else {
        listener.call(thisArg, event);
      }
    }
  }
});

// node_modules/ws/lib/extension.js
var require_extension = __commonJS({
  "node_modules/ws/lib/extension.js"(exports, module) {
    "use strict";
    var { tokenChars } = require_validation();
    function push(dest, name2, elem) {
      if (dest[name2] === void 0) dest[name2] = [elem];
      else dest[name2].push(elem);
    }
    function parse(header) {
      const offers = /* @__PURE__ */ Object.create(null);
      let params = /* @__PURE__ */ Object.create(null);
      let mustUnescape = false;
      let isEscaping = false;
      let inQuotes = false;
      let extensionName;
      let paramName;
      let start = -1;
      let code = -1;
      let end = -1;
      let i = 0;
      for (; i < header.length; i++) {
        code = header.charCodeAt(i);
        if (extensionName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (i !== 0 && (code === 32 || code === 9)) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            const name2 = header.slice(start, end);
            if (code === 44) {
              push(offers, name2, params);
              params = /* @__PURE__ */ Object.create(null);
            } else {
              extensionName = name2;
            }
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else if (paramName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (code === 32 || code === 9) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            push(params, header.slice(start, end), true);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            start = end = -1;
          } else if (code === 61 && start !== -1 && end === -1) {
            paramName = header.slice(start, i);
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else {
          if (isEscaping) {
            if (tokenChars[code] !== 1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (start === -1) start = i;
            else if (!mustUnescape) mustUnescape = true;
            isEscaping = false;
          } else if (inQuotes) {
            if (tokenChars[code] === 1) {
              if (start === -1) start = i;
            } else if (code === 34 && start !== -1) {
              inQuotes = false;
              end = i;
            } else if (code === 92) {
              isEscaping = true;
            } else {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
          } else if (code === 34 && header.charCodeAt(i - 1) === 61) {
            inQuotes = true;
          } else if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (start !== -1 && (code === 32 || code === 9)) {
            if (end === -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            let value = header.slice(start, end);
            if (mustUnescape) {
              value = value.replace(/\\/g, "");
              mustUnescape = false;
            }
            push(params, paramName, value);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            paramName = void 0;
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        }
      }
      if (start === -1 || inQuotes || code === 32 || code === 9) {
        throw new SyntaxError("Unexpected end of input");
      }
      if (end === -1) end = i;
      const token = header.slice(start, end);
      if (extensionName === void 0) {
        push(offers, token, params);
      } else {
        if (paramName === void 0) {
          push(params, token, true);
        } else if (mustUnescape) {
          push(params, paramName, token.replace(/\\/g, ""));
        } else {
          push(params, paramName, token);
        }
        push(offers, extensionName, params);
      }
      return offers;
    }
    function format(extensions) {
      return Object.keys(extensions).map((extension2) => {
        let configurations = extensions[extension2];
        if (!Array.isArray(configurations)) configurations = [configurations];
        return configurations.map((params) => {
          return [extension2].concat(
            Object.keys(params).map((k) => {
              let values = params[k];
              if (!Array.isArray(values)) values = [values];
              return values.map((v) => v === true ? k : `${k}=${v}`).join("; ");
            })
          ).join("; ");
        }).join(", ");
      }).join(", ");
    }
    module.exports = { format, parse };
  }
});

// node_modules/ws/lib/websocket.js
var require_websocket = __commonJS({
  "node_modules/ws/lib/websocket.js"(exports, module) {
    "use strict";
    var EventEmitter3 = __require("events");
    var https2 = __require("https");
    var http3 = __require("http");
    var net3 = __require("net");
    var tls = __require("tls");
    var { randomBytes: randomBytes2, createHash } = __require("crypto");
    var { Duplex: Duplex2, Readable } = __require("stream");
    var { URL: URL2 } = __require("url");
    var PerMessageDeflate2 = require_permessage_deflate();
    var Receiver2 = require_receiver();
    var Sender2 = require_sender();
    var { isBlob } = require_validation();
    var {
      BINARY_TYPES,
      CLOSE_TIMEOUT,
      EMPTY_BUFFER,
      GUID,
      kForOnEventAttribute,
      kListener,
      kStatusCode,
      kWebSocket,
      NOOP
    } = require_constants();
    var {
      EventTarget: { addEventListener, removeEventListener }
    } = require_event_target();
    var { format, parse } = require_extension();
    var { toBuffer } = require_buffer_util();
    var kAborted = Symbol("kAborted");
    var protocolVersions = [8, 13];
    var readyStates = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"];
    var subprotocolRegex = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/;
    var WebSocket2 = class _WebSocket extends EventEmitter3 {
      /**
       * Create a new `WebSocket`.
       *
       * @param {(String|URL)} address The URL to which to connect
       * @param {(String|String[])} [protocols] The subprotocols
       * @param {Object} [options] Connection options
       */
      constructor(address, protocols, options) {
        super();
        this._binaryType = BINARY_TYPES[0];
        this._closeCode = 1006;
        this._closeFrameReceived = false;
        this._closeFrameSent = false;
        this._closeMessage = EMPTY_BUFFER;
        this._closeTimer = null;
        this._errorEmitted = false;
        this._extensions = {};
        this._paused = false;
        this._protocol = "";
        this._readyState = _WebSocket.CONNECTING;
        this._receiver = null;
        this._sender = null;
        this._socket = null;
        if (address !== null) {
          this._bufferedAmount = 0;
          this._isServer = false;
          this._redirects = 0;
          if (protocols === void 0) {
            if (!options || options.protocols === void 0) {
              protocols = [];
            } else if (Array.isArray(options.protocols)) {
              protocols = options.protocols;
            } else {
              protocols = [options.protocols];
            }
          } else if (!Array.isArray(protocols)) {
            if (typeof protocols === "object" && protocols !== null) {
              options = protocols;
              if (options.protocols === void 0) {
                protocols = [];
              } else if (Array.isArray(options.protocols)) {
                protocols = options.protocols;
              } else {
                protocols = [options.protocols];
              }
            } else {
              protocols = [protocols];
            }
          }
          initAsClient(this, address, protocols, options);
        } else {
          this._autoPong = options.autoPong;
          this._closeTimeout = options.closeTimeout;
          this._isServer = true;
        }
      }
      /**
       * For historical reasons, the custom "nodebuffer" type is used by the default
       * instead of "blob".
       *
       * @type {String}
       */
      get binaryType() {
        return this._binaryType;
      }
      set binaryType(type) {
        if (!BINARY_TYPES.includes(type)) return;
        this._binaryType = type;
        if (this._receiver) this._receiver._binaryType = type;
      }
      /**
       * @type {Number}
       */
      get bufferedAmount() {
        if (!this._socket) return this._bufferedAmount;
        return this._socket._writableState.length + this._sender._bufferedBytes;
      }
      /**
       * @type {String}
       */
      get extensions() {
        return Object.keys(this._extensions).join();
      }
      /**
       * @type {Boolean}
       */
      get isPaused() {
        return this._paused;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onclose() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onerror() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onopen() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onmessage() {
        return null;
      }
      /**
       * @type {String}
       */
      get protocol() {
        return this._protocol;
      }
      /**
       * @type {Number}
       */
      get readyState() {
        return this._readyState;
      }
      /**
       * @type {String}
       */
      get url() {
        return this._url;
      }
      /**
       * Set up the socket and the internal resources.
       *
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Object} options Options object
       * @param {Boolean} [options.allowSynchronousEvents=false] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Number} [options.maxBufferedChunks=0] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=0] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=0] The maximum allowed message size
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @private
       */
      setSocket(socket, head, options) {
        const receiver = new Receiver2({
          allowSynchronousEvents: options.allowSynchronousEvents,
          binaryType: this.binaryType,
          extensions: this._extensions,
          isServer: this._isServer,
          maxBufferedChunks: options.maxBufferedChunks,
          maxFragments: options.maxFragments,
          maxPayload: options.maxPayload,
          skipUTF8Validation: options.skipUTF8Validation
        });
        const sender = new Sender2(socket, this._extensions, options.generateMask);
        this._receiver = receiver;
        this._sender = sender;
        this._socket = socket;
        receiver[kWebSocket] = this;
        sender[kWebSocket] = this;
        socket[kWebSocket] = this;
        receiver.on("conclude", receiverOnConclude);
        receiver.on("drain", receiverOnDrain);
        receiver.on("error", receiverOnError);
        receiver.on("message", receiverOnMessage);
        receiver.on("ping", receiverOnPing);
        receiver.on("pong", receiverOnPong);
        sender.onerror = senderOnError;
        if (socket.setTimeout) socket.setTimeout(0);
        if (socket.setNoDelay) socket.setNoDelay();
        if (head.length > 0) socket.unshift(head);
        socket.on("close", socketOnClose);
        socket.on("data", socketOnData);
        socket.on("end", socketOnEnd);
        socket.on("error", socketOnError);
        this._readyState = _WebSocket.OPEN;
        this.emit("open");
      }
      /**
       * Emit the `'close'` event.
       *
       * @private
       */
      emitClose() {
        if (!this._socket) {
          this._readyState = _WebSocket.CLOSED;
          this.emit("close", this._closeCode, this._closeMessage);
          return;
        }
        if (this._extensions[PerMessageDeflate2.extensionName]) {
          this._extensions[PerMessageDeflate2.extensionName].cleanup();
        }
        this._receiver.removeAllListeners();
        this._readyState = _WebSocket.CLOSED;
        this.emit("close", this._closeCode, this._closeMessage);
      }
      /**
       * Start a closing handshake.
       *
       *          +----------+   +-----------+   +----------+
       *     - - -|ws.close()|-->|close frame|-->|ws.close()|- - -
       *    |     +----------+   +-----------+   +----------+     |
       *          +----------+   +-----------+         |
       * CLOSING  |ws.close()|<--|close frame|<--+-----+       CLOSING
       *          +----------+   +-----------+   |
       *    |           |                        |   +---+        |
       *                +------------------------+-->|fin| - - - -
       *    |         +---+                      |   +---+
       *     - - - - -|fin|<---------------------+
       *              +---+
       *
       * @param {Number} [code] Status code explaining why the connection is closing
       * @param {(String|Buffer)} [data] The reason why the connection is
       *     closing
       * @public
       */
      close(code, data) {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this.readyState === _WebSocket.CLOSING) {
          if (this._closeFrameSent && (this._closeFrameReceived || this._receiver._writableState.errorEmitted)) {
            this._socket.end();
          }
          return;
        }
        this._sender.close(code, data, !this._isServer, (err) => {
          if (err) return;
          this._closeFrameSent = true;
          if (this._closeFrameReceived || this._receiver._writableState.errorEmitted) {
            this._socket.end();
          }
        });
        this._readyState = _WebSocket.CLOSING;
        setCloseTimer(this);
      }
      /**
       * Pause the socket.
       *
       * @public
       */
      pause() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = true;
        this._socket.pause();
      }
      /**
       * Send a ping.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the ping is sent
       * @public
       */
      ping(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.ping(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Send a pong.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the pong is sent
       * @public
       */
      pong(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.pong(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Resume the socket.
       *
       * @public
       */
      resume() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = false;
        if (!this._receiver._writableState.needDrain) this._socket.resume();
      }
      /**
       * Send a data message.
       *
       * @param {*} data The message to send
       * @param {Object} [options] Options object
       * @param {Boolean} [options.binary] Specifies whether `data` is binary or
       *     text
       * @param {Boolean} [options.compress] Specifies whether or not to compress
       *     `data`
       * @param {Boolean} [options.fin=true] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when data is written out
       * @public
       */
      send(data, options, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof options === "function") {
          cb = options;
          options = {};
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        const opts = {
          binary: typeof data !== "string",
          mask: !this._isServer,
          compress: true,
          fin: true,
          ...options
        };
        if (!this._extensions[PerMessageDeflate2.extensionName]) {
          opts.compress = false;
        }
        this._sender.send(data || EMPTY_BUFFER, opts, cb);
      }
      /**
       * Forcibly close the connection.
       *
       * @public
       */
      terminate() {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this._socket) {
          this._readyState = _WebSocket.CLOSING;
          this._socket.destroy();
        }
      }
    };
    Object.defineProperty(WebSocket2, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket2.prototype, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket2, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket2.prototype, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket2, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket2.prototype, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket2, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    Object.defineProperty(WebSocket2.prototype, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    [
      "binaryType",
      "bufferedAmount",
      "extensions",
      "isPaused",
      "protocol",
      "readyState",
      "url"
    ].forEach((property) => {
      Object.defineProperty(WebSocket2.prototype, property, { enumerable: true });
    });
    ["open", "error", "close", "message"].forEach((method) => {
      Object.defineProperty(WebSocket2.prototype, `on${method}`, {
        enumerable: true,
        get() {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) return listener[kListener];
          }
          return null;
        },
        set(handler) {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) {
              this.removeListener(method, listener);
              break;
            }
          }
          if (typeof handler !== "function") return;
          this.addEventListener(method, handler, {
            [kForOnEventAttribute]: true
          });
        }
      });
    });
    WebSocket2.prototype.addEventListener = addEventListener;
    WebSocket2.prototype.removeEventListener = removeEventListener;
    module.exports = WebSocket2;
    function initAsClient(websocket, address, protocols, options) {
      const opts = {
        allowSynchronousEvents: true,
        autoPong: true,
        closeTimeout: CLOSE_TIMEOUT,
        protocolVersion: protocolVersions[1],
        maxBufferedChunks: 256 * 1024,
        maxFragments: 16 * 1024,
        maxPayload: 100 * 1024 * 1024,
        skipUTF8Validation: false,
        perMessageDeflate: true,
        followRedirects: false,
        maxRedirects: 10,
        ...options,
        socketPath: void 0,
        hostname: void 0,
        protocol: void 0,
        protocols: void 0,
        timeout: void 0,
        method: "GET",
        host: void 0,
        path: void 0,
        port: void 0
      };
      websocket._autoPong = opts.autoPong;
      websocket._closeTimeout = opts.closeTimeout;
      if (!protocolVersions.includes(opts.protocolVersion)) {
        throw new RangeError(
          `Unsupported protocol version: ${opts.protocolVersion} (supported versions: ${protocolVersions.join(", ")})`
        );
      }
      let parsedUrl;
      if (address instanceof URL2) {
        parsedUrl = address;
      } else {
        try {
          parsedUrl = new URL2(address);
        } catch {
          throw new SyntaxError(`Invalid URL: ${address}`);
        }
      }
      if (parsedUrl.protocol === "http:") {
        parsedUrl.protocol = "ws:";
      } else if (parsedUrl.protocol === "https:") {
        parsedUrl.protocol = "wss:";
      }
      websocket._url = parsedUrl.href;
      const isSecure = parsedUrl.protocol === "wss:";
      const isIpcUrl = parsedUrl.protocol === "ws+unix:";
      let invalidUrlMessage;
      if (parsedUrl.protocol !== "ws:" && !isSecure && !isIpcUrl) {
        invalidUrlMessage = `The URL's protocol must be one of "ws:", "wss:", "http:", "https:", or "ws+unix:"`;
      } else if (isIpcUrl && !parsedUrl.pathname) {
        invalidUrlMessage = "The URL's pathname is empty";
      } else if (parsedUrl.hash) {
        invalidUrlMessage = "The URL contains a fragment identifier";
      }
      if (invalidUrlMessage) {
        const err = new SyntaxError(invalidUrlMessage);
        if (websocket._redirects === 0) {
          throw err;
        } else {
          emitErrorAndClose(websocket, err);
          return;
        }
      }
      const defaultPort = isSecure ? 443 : 80;
      const key = randomBytes2(16).toString("base64");
      const request = isSecure ? https2.request : http3.request;
      const protocolSet = /* @__PURE__ */ new Set();
      let perMessageDeflate;
      opts.createConnection = opts.createConnection || (isSecure ? tlsConnect : netConnect);
      opts.defaultPort = opts.defaultPort || defaultPort;
      opts.port = parsedUrl.port || defaultPort;
      opts.host = parsedUrl.hostname.startsWith("[") ? parsedUrl.hostname.slice(1, -1) : parsedUrl.hostname;
      opts.headers = {
        ...opts.headers,
        "Sec-WebSocket-Version": opts.protocolVersion,
        "Sec-WebSocket-Key": key,
        Connection: "Upgrade",
        Upgrade: "websocket"
      };
      opts.path = parsedUrl.pathname + parsedUrl.search;
      opts.timeout = opts.handshakeTimeout;
      if (opts.perMessageDeflate) {
        perMessageDeflate = new PerMessageDeflate2({
          ...opts.perMessageDeflate,
          isServer: false,
          maxPayload: opts.maxPayload
        });
        opts.headers["Sec-WebSocket-Extensions"] = format({
          [PerMessageDeflate2.extensionName]: perMessageDeflate.offer()
        });
      }
      if (protocols.length) {
        for (const protocol of protocols) {
          if (typeof protocol !== "string" || !subprotocolRegex.test(protocol) || protocolSet.has(protocol)) {
            throw new SyntaxError(
              "An invalid or duplicated subprotocol was specified"
            );
          }
          protocolSet.add(protocol);
        }
        opts.headers["Sec-WebSocket-Protocol"] = protocols.join(",");
      }
      if (opts.origin) {
        if (opts.protocolVersion < 13) {
          opts.headers["Sec-WebSocket-Origin"] = opts.origin;
        } else {
          opts.headers.Origin = opts.origin;
        }
      }
      if (parsedUrl.username || parsedUrl.password) {
        opts.auth = `${parsedUrl.username}:${parsedUrl.password}`;
      }
      if (isIpcUrl) {
        const parts = opts.path.split(":");
        opts.socketPath = parts[0];
        opts.path = parts[1];
      }
      let req;
      if (opts.followRedirects) {
        if (websocket._redirects === 0) {
          websocket._originalIpc = isIpcUrl;
          websocket._originalSecure = isSecure;
          websocket._originalHostOrSocketPath = isIpcUrl ? opts.socketPath : parsedUrl.host;
          const headers = options && options.headers;
          options = { ...options, headers: {} };
          if (headers) {
            for (const [key2, value] of Object.entries(headers)) {
              options.headers[key2.toLowerCase()] = value;
            }
          }
        } else if (websocket.listenerCount("redirect") === 0) {
          const isSameHost = isIpcUrl ? websocket._originalIpc ? opts.socketPath === websocket._originalHostOrSocketPath : false : websocket._originalIpc ? false : parsedUrl.host === websocket._originalHostOrSocketPath;
          if (!isSameHost || websocket._originalSecure && !isSecure) {
            delete opts.headers.authorization;
            delete opts.headers.cookie;
            if (!isSameHost) delete opts.headers.host;
            opts.auth = void 0;
          }
        }
        if (opts.auth && !options.headers.authorization) {
          options.headers.authorization = "Basic " + Buffer.from(opts.auth).toString("base64");
        }
        req = websocket._req = request(opts);
        if (websocket._redirects) {
          websocket.emit("redirect", websocket.url, req);
        }
      } else {
        req = websocket._req = request(opts);
      }
      if (opts.timeout) {
        req.on("timeout", () => {
          abortHandshake(websocket, req, "Opening handshake has timed out");
        });
      }
      req.on("error", (err) => {
        if (req === null || req[kAborted]) return;
        req = websocket._req = null;
        emitErrorAndClose(websocket, err);
      });
      req.on("response", (res) => {
        const location = res.headers.location;
        const statusCode = res.statusCode;
        if (location && opts.followRedirects && statusCode >= 300 && statusCode < 400) {
          if (++websocket._redirects > opts.maxRedirects) {
            abortHandshake(websocket, req, "Maximum redirects exceeded");
            return;
          }
          req.abort();
          let addr;
          try {
            addr = new URL2(location, address);
          } catch (e) {
            const err = new SyntaxError(`Invalid URL: ${location}`);
            emitErrorAndClose(websocket, err);
            return;
          }
          initAsClient(websocket, addr, protocols, options);
        } else if (!websocket.emit("unexpected-response", req, res)) {
          abortHandshake(
            websocket,
            req,
            `Unexpected server response: ${res.statusCode}`
          );
        }
      });
      req.on("upgrade", (res, socket, head) => {
        websocket.emit("upgrade", res);
        if (websocket.readyState !== WebSocket2.CONNECTING) return;
        req = websocket._req = null;
        const upgrade = res.headers.upgrade;
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          abortHandshake(websocket, socket, "Invalid Upgrade header");
          return;
        }
        const digest = createHash("sha1").update(key + GUID).digest("base64");
        if (res.headers["sec-websocket-accept"] !== digest) {
          abortHandshake(websocket, socket, "Invalid Sec-WebSocket-Accept header");
          return;
        }
        const serverProt = res.headers["sec-websocket-protocol"];
        let protError;
        if (serverProt !== void 0) {
          if (!protocolSet.size) {
            protError = "Server sent a subprotocol but none was requested";
          } else if (!protocolSet.has(serverProt)) {
            protError = "Server sent an invalid subprotocol";
          }
        } else if (protocolSet.size) {
          protError = "Server sent no subprotocol";
        }
        if (protError) {
          abortHandshake(websocket, socket, protError);
          return;
        }
        if (serverProt) websocket._protocol = serverProt;
        const secWebSocketExtensions = res.headers["sec-websocket-extensions"];
        if (secWebSocketExtensions !== void 0) {
          if (!perMessageDeflate) {
            const message = "Server sent a Sec-WebSocket-Extensions header but no extension was requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          let extensions;
          try {
            extensions = parse(secWebSocketExtensions);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          const extensionNames = Object.keys(extensions);
          if (extensionNames.length !== 1 || extensionNames[0] !== PerMessageDeflate2.extensionName) {
            const message = "Server indicated an extension that was not requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          try {
            perMessageDeflate.accept(extensions[PerMessageDeflate2.extensionName]);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          websocket._extensions[PerMessageDeflate2.extensionName] = perMessageDeflate;
        }
        websocket.setSocket(socket, head, {
          allowSynchronousEvents: opts.allowSynchronousEvents,
          generateMask: opts.generateMask,
          maxBufferedChunks: opts.maxBufferedChunks,
          maxFragments: opts.maxFragments,
          maxPayload: opts.maxPayload,
          skipUTF8Validation: opts.skipUTF8Validation
        });
      });
      if (opts.finishRequest) {
        opts.finishRequest(req, websocket);
      } else {
        req.end();
      }
    }
    function emitErrorAndClose(websocket, err) {
      websocket._readyState = WebSocket2.CLOSING;
      websocket._errorEmitted = true;
      websocket.emit("error", err);
      websocket.emitClose();
    }
    function netConnect(options) {
      options.path = options.socketPath;
      return net3.connect(options);
    }
    function tlsConnect(options) {
      options.path = void 0;
      if (!options.servername && options.servername !== "") {
        options.servername = net3.isIP(options.host) ? "" : options.host;
      }
      return tls.connect(options);
    }
    function abortHandshake(websocket, stream, message) {
      websocket._readyState = WebSocket2.CLOSING;
      const err = new Error(message);
      Error.captureStackTrace(err, abortHandshake);
      if (stream.setHeader) {
        stream[kAborted] = true;
        stream.abort();
        if (stream.socket && !stream.socket.destroyed) {
          stream.socket.destroy();
        }
        process.nextTick(emitErrorAndClose, websocket, err);
      } else {
        stream.destroy(err);
        stream.once("error", websocket.emit.bind(websocket, "error"));
        stream.once("close", websocket.emitClose.bind(websocket));
      }
    }
    function sendAfterClose(websocket, data, cb) {
      if (data) {
        const length = isBlob(data) ? data.size : toBuffer(data).length;
        if (websocket._socket) websocket._sender._bufferedBytes += length;
        else websocket._bufferedAmount += length;
      }
      if (cb) {
        const err = new Error(
          `WebSocket is not open: readyState ${websocket.readyState} (${readyStates[websocket.readyState]})`
        );
        process.nextTick(cb, err);
      }
    }
    function receiverOnConclude(code, reason) {
      const websocket = this[kWebSocket];
      websocket._closeFrameReceived = true;
      websocket._closeMessage = reason;
      websocket._closeCode = code;
      if (websocket._socket[kWebSocket] === void 0) return;
      websocket._socket.removeListener("data", socketOnData);
      process.nextTick(resume, websocket._socket);
      if (code === 1005) websocket.close();
      else websocket.close(code, reason);
    }
    function receiverOnDrain() {
      const websocket = this[kWebSocket];
      if (!websocket.isPaused) websocket._socket.resume();
    }
    function receiverOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket._socket[kWebSocket] !== void 0) {
        websocket._socket.removeListener("data", socketOnData);
        process.nextTick(resume, websocket._socket);
        websocket.close(err[kStatusCode]);
      }
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function receiverOnFinish() {
      this[kWebSocket].emitClose();
    }
    function receiverOnMessage(data, isBinary) {
      this[kWebSocket].emit("message", data, isBinary);
    }
    function receiverOnPing(data) {
      const websocket = this[kWebSocket];
      if (websocket._autoPong) websocket.pong(data, !this._isServer, NOOP);
      websocket.emit("ping", data);
    }
    function receiverOnPong(data) {
      this[kWebSocket].emit("pong", data);
    }
    function resume(stream) {
      stream.resume();
    }
    function senderOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket.readyState === WebSocket2.CLOSED) return;
      if (websocket.readyState === WebSocket2.OPEN) {
        websocket._readyState = WebSocket2.CLOSING;
        setCloseTimer(websocket);
      }
      this._socket.end();
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function setCloseTimer(websocket) {
      websocket._closeTimer = setTimeout(
        websocket._socket.destroy.bind(websocket._socket),
        websocket._closeTimeout
      );
    }
    function socketOnClose() {
      const websocket = this[kWebSocket];
      this.removeListener("close", socketOnClose);
      this.removeListener("data", socketOnData);
      this.removeListener("end", socketOnEnd);
      websocket._readyState = WebSocket2.CLOSING;
      if (!this._readableState.endEmitted && !websocket._closeFrameReceived && !websocket._receiver._writableState.errorEmitted && this._readableState.length !== 0) {
        const chunk = this.read(this._readableState.length);
        websocket._receiver.write(chunk);
      }
      websocket._receiver.end();
      this[kWebSocket] = void 0;
      clearTimeout(websocket._closeTimer);
      if (websocket._receiver._writableState.finished || websocket._receiver._writableState.errorEmitted) {
        websocket.emitClose();
      } else {
        websocket._receiver.on("error", receiverOnFinish);
        websocket._receiver.on("finish", receiverOnFinish);
      }
    }
    function socketOnData(chunk) {
      if (!this[kWebSocket]._receiver.write(chunk)) {
        this.pause();
      }
    }
    function socketOnEnd() {
      const websocket = this[kWebSocket];
      websocket._readyState = WebSocket2.CLOSING;
      websocket._receiver.end();
      this.end();
    }
    function socketOnError() {
      const websocket = this[kWebSocket];
      this.removeListener("error", socketOnError);
      this.on("error", NOOP);
      if (websocket) {
        websocket._readyState = WebSocket2.CLOSING;
        this.destroy();
      }
    }
  }
});

// node_modules/ws/lib/stream.js
var require_stream = __commonJS({
  "node_modules/ws/lib/stream.js"(exports, module) {
    "use strict";
    var WebSocket2 = require_websocket();
    var { Duplex: Duplex2 } = __require("stream");
    function emitClose(stream) {
      stream.emit("close");
    }
    function duplexOnEnd() {
      if (!this.destroyed && this._writableState.finished) {
        this.destroy();
      }
    }
    function duplexOnError(err) {
      this.removeListener("error", duplexOnError);
      this.destroy();
      if (this.listenerCount("error") === 0) {
        this.emit("error", err);
      }
    }
    function createWebSocketStream2(ws, options) {
      let terminateOnDestroy = true;
      const duplex = new Duplex2({
        ...options,
        autoDestroy: false,
        emitClose: false,
        objectMode: false,
        writableObjectMode: false
      });
      ws.on("message", function message(msg, isBinary) {
        const data = !isBinary && duplex._readableState.objectMode ? msg.toString() : msg;
        if (!duplex.push(data)) ws.pause();
      });
      ws.once("error", function error(err) {
        if (duplex.destroyed) return;
        terminateOnDestroy = false;
        duplex.destroy(err);
      });
      ws.once("close", function close() {
        if (duplex.destroyed) return;
        duplex.push(null);
      });
      duplex._destroy = function(err, callback) {
        if (ws.readyState === ws.CLOSED) {
          callback(err);
          process.nextTick(emitClose, duplex);
          return;
        }
        let called = false;
        ws.once("error", function error(err2) {
          called = true;
          callback(err2);
        });
        ws.once("close", function close() {
          if (!called) callback(err);
          process.nextTick(emitClose, duplex);
        });
        if (terminateOnDestroy) ws.terminate();
      };
      duplex._final = function(callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function open() {
            duplex._final(callback);
          });
          return;
        }
        if (ws._socket === null) return;
        if (ws._socket._writableState.finished) {
          callback();
          if (duplex._readableState.endEmitted) duplex.destroy();
        } else {
          ws._socket.once("finish", function finish() {
            callback();
          });
          ws.close();
        }
      };
      duplex._read = function() {
        if (ws.isPaused) ws.resume();
      };
      duplex._write = function(chunk, encoding, callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function open() {
            duplex._write(chunk, encoding, callback);
          });
          return;
        }
        ws.send(chunk, callback);
      };
      duplex.on("end", duplexOnEnd);
      duplex.on("error", duplexOnError);
      return duplex;
    }
    module.exports = createWebSocketStream2;
  }
});

// node_modules/ws/lib/subprotocol.js
var require_subprotocol = __commonJS({
  "node_modules/ws/lib/subprotocol.js"(exports, module) {
    "use strict";
    var { tokenChars } = require_validation();
    function parse(header) {
      const protocols = /* @__PURE__ */ new Set();
      let start = -1;
      let end = -1;
      let i = 0;
      for (i; i < header.length; i++) {
        const code = header.charCodeAt(i);
        if (end === -1 && tokenChars[code] === 1) {
          if (start === -1) start = i;
        } else if (i !== 0 && (code === 32 || code === 9)) {
          if (end === -1 && start !== -1) end = i;
        } else if (code === 44) {
          if (start === -1) {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
          if (end === -1) end = i;
          const protocol2 = header.slice(start, end);
          if (protocols.has(protocol2)) {
            throw new SyntaxError(`The "${protocol2}" subprotocol is duplicated`);
          }
          protocols.add(protocol2);
          start = end = -1;
        } else {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
      }
      if (start === -1 || end !== -1) {
        throw new SyntaxError("Unexpected end of input");
      }
      const protocol = header.slice(start, i);
      if (protocols.has(protocol)) {
        throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
      }
      protocols.add(protocol);
      return protocols;
    }
    module.exports = { parse };
  }
});

// node_modules/ws/lib/websocket-server.js
var require_websocket_server = __commonJS({
  "node_modules/ws/lib/websocket-server.js"(exports, module) {
    "use strict";
    var EventEmitter3 = __require("events");
    var http3 = __require("http");
    var { Duplex: Duplex2 } = __require("stream");
    var { createHash } = __require("crypto");
    var extension2 = require_extension();
    var PerMessageDeflate2 = require_permessage_deflate();
    var subprotocol2 = require_subprotocol();
    var WebSocket2 = require_websocket();
    var { CLOSE_TIMEOUT, GUID, kWebSocket } = require_constants();
    var keyRegex = /^[+/0-9A-Za-z]{22}==$/;
    var RUNNING = 0;
    var CLOSING = 1;
    var CLOSED = 2;
    var WebSocketServer2 = class extends EventEmitter3 {
      /**
       * Create a `WebSocketServer` instance.
       *
       * @param {Object} options Configuration options
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Boolean} [options.autoPong=true] Specifies whether or not to
       *     automatically send a pong in response to a ping
       * @param {Number} [options.backlog=511] The maximum length of the queue of
       *     pending connections
       * @param {Boolean} [options.clientTracking=true] Specifies whether or not to
       *     track clients
       * @param {Number} [options.closeTimeout=30000] Duration in milliseconds to
       *     wait for the closing handshake to finish after `websocket.close()` is
       *     called
       * @param {Function} [options.handleProtocols] A hook to handle protocols
       * @param {String} [options.host] The hostname where to bind the server
       * @param {Number} [options.maxBufferedChunks=262144] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=16384] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=104857600] The maximum allowed message
       *     size
       * @param {Boolean} [options.noServer=false] Enable no server mode
       * @param {String} [options.path] Accept only connections matching this path
       * @param {(Boolean|Object)} [options.perMessageDeflate=false] Enable/disable
       *     permessage-deflate
       * @param {Number} [options.port] The port where to bind the server
       * @param {(http.Server|https.Server)} [options.server] A pre-created HTTP/S
       *     server to use
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @param {Function} [options.verifyClient] A hook to reject connections
       * @param {Function} [options.WebSocket=WebSocket] Specifies the `WebSocket`
       *     class to use. It must be the `WebSocket` class or class that extends it
       * @param {Function} [callback] A listener for the `listening` event
       */
      constructor(options, callback) {
        super();
        options = {
          allowSynchronousEvents: true,
          autoPong: true,
          maxBufferedChunks: 256 * 1024,
          maxFragments: 16 * 1024,
          maxPayload: 100 * 1024 * 1024,
          skipUTF8Validation: false,
          perMessageDeflate: false,
          handleProtocols: null,
          clientTracking: true,
          closeTimeout: CLOSE_TIMEOUT,
          verifyClient: null,
          noServer: false,
          backlog: null,
          // use default (511 as implemented in net.js)
          server: null,
          host: null,
          path: null,
          port: null,
          WebSocket: WebSocket2,
          ...options
        };
        if (options.port == null && !options.server && !options.noServer || options.port != null && (options.server || options.noServer) || options.server && options.noServer) {
          throw new TypeError(
            'One and only one of the "port", "server", or "noServer" options must be specified'
          );
        }
        if (options.port != null) {
          this._server = http3.createServer((req, res) => {
            const body = http3.STATUS_CODES[426];
            res.writeHead(426, {
              "Content-Length": body.length,
              "Content-Type": "text/plain"
            });
            res.end(body);
          });
          this._server.listen(
            options.port,
            options.host,
            options.backlog,
            callback
          );
        } else if (options.server) {
          this._server = options.server;
        }
        if (this._server) {
          const emitConnection = this.emit.bind(this, "connection");
          this._removeListeners = addListeners(this._server, {
            listening: this.emit.bind(this, "listening"),
            error: this.emit.bind(this, "error"),
            upgrade: (req, socket, head) => {
              this.handleUpgrade(req, socket, head, emitConnection);
            }
          });
        }
        if (options.perMessageDeflate === true) options.perMessageDeflate = {};
        if (options.clientTracking) {
          this.clients = /* @__PURE__ */ new Set();
          this._shouldEmitClose = false;
        }
        this.options = options;
        this._state = RUNNING;
      }
      /**
       * Returns the bound address, the address family name, and port of the server
       * as reported by the operating system if listening on an IP socket.
       * If the server is listening on a pipe or UNIX domain socket, the name is
       * returned as a string.
       *
       * @return {(Object|String|null)} The address of the server
       * @public
       */
      address() {
        if (this.options.noServer) {
          throw new Error('The server is operating in "noServer" mode');
        }
        if (!this._server) return null;
        return this._server.address();
      }
      /**
       * Stop the server from accepting new connections and emit the `'close'` event
       * when all existing connections are closed.
       *
       * @param {Function} [cb] A one-time listener for the `'close'` event
       * @public
       */
      close(cb) {
        if (this._state === CLOSED) {
          if (cb) {
            this.once("close", () => {
              cb(new Error("The server is not running"));
            });
          }
          process.nextTick(emitClose, this);
          return;
        }
        if (cb) this.once("close", cb);
        if (this._state === CLOSING) return;
        this._state = CLOSING;
        if (this.options.noServer || this.options.server) {
          if (this._server) {
            this._removeListeners();
            this._removeListeners = this._server = null;
          }
          if (this.clients) {
            if (!this.clients.size) {
              process.nextTick(emitClose, this);
            } else {
              this._shouldEmitClose = true;
            }
          } else {
            process.nextTick(emitClose, this);
          }
        } else {
          const server = this._server;
          this._removeListeners();
          this._removeListeners = this._server = null;
          server.close(() => {
            emitClose(this);
          });
        }
      }
      /**
       * See if a given request should be handled by this server instance.
       *
       * @param {http.IncomingMessage} req Request object to inspect
       * @return {Boolean} `true` if the request is valid, else `false`
       * @public
       */
      shouldHandle(req) {
        if (this.options.path) {
          const index = req.url.indexOf("?");
          const pathname = index !== -1 ? req.url.slice(0, index) : req.url;
          if (pathname !== this.options.path) return false;
        }
        return true;
      }
      /**
       * Handle a HTTP Upgrade request.
       *
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @public
       */
      handleUpgrade(req, socket, head, cb) {
        socket.on("error", socketOnError);
        const key = req.headers["sec-websocket-key"];
        const upgrade = req.headers.upgrade;
        const version = +req.headers["sec-websocket-version"];
        if (req.method !== "GET") {
          const message = "Invalid HTTP method";
          abortHandshakeOrEmitwsClientError(this, req, socket, 405, message);
          return;
        }
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          const message = "Invalid Upgrade header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (key === void 0 || !keyRegex.test(key)) {
          const message = "Missing or invalid Sec-WebSocket-Key header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (version !== 13 && version !== 8) {
          const message = "Missing or invalid Sec-WebSocket-Version header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message, {
            "Sec-WebSocket-Version": "13, 8"
          });
          return;
        }
        if (!this.shouldHandle(req)) {
          abortHandshake(socket, 400);
          return;
        }
        const secWebSocketProtocol = req.headers["sec-websocket-protocol"];
        let protocols = /* @__PURE__ */ new Set();
        if (secWebSocketProtocol !== void 0) {
          try {
            protocols = subprotocol2.parse(secWebSocketProtocol);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Protocol header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        const secWebSocketExtensions = req.headers["sec-websocket-extensions"];
        const extensions = {};
        if (this.options.perMessageDeflate && secWebSocketExtensions !== void 0) {
          const perMessageDeflate = new PerMessageDeflate2({
            ...this.options.perMessageDeflate,
            isServer: true,
            maxPayload: this.options.maxPayload
          });
          try {
            const offers = extension2.parse(secWebSocketExtensions);
            if (offers[PerMessageDeflate2.extensionName]) {
              perMessageDeflate.accept(offers[PerMessageDeflate2.extensionName]);
              extensions[PerMessageDeflate2.extensionName] = perMessageDeflate;
            }
          } catch (err) {
            const message = "Invalid or unacceptable Sec-WebSocket-Extensions header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        if (this.options.verifyClient) {
          const info = {
            origin: req.headers[`${version === 8 ? "sec-websocket-origin" : "origin"}`],
            secure: !!(req.socket.authorized || req.socket.encrypted),
            req
          };
          if (this.options.verifyClient.length === 2) {
            this.options.verifyClient(info, (verified, code, message, headers) => {
              if (!verified) {
                return abortHandshake(socket, code || 401, message, headers);
              }
              this.completeUpgrade(
                extensions,
                key,
                protocols,
                req,
                socket,
                head,
                cb
              );
            });
            return;
          }
          if (!this.options.verifyClient(info)) return abortHandshake(socket, 401);
        }
        this.completeUpgrade(extensions, key, protocols, req, socket, head, cb);
      }
      /**
       * Upgrade the connection to WebSocket.
       *
       * @param {Object} extensions The accepted extensions
       * @param {String} key The value of the `Sec-WebSocket-Key` header
       * @param {Set} protocols The subprotocols
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @throws {Error} If called more than once with the same socket
       * @private
       */
      completeUpgrade(extensions, key, protocols, req, socket, head, cb) {
        if (!socket.readable || !socket.writable) return socket.destroy();
        if (socket[kWebSocket]) {
          throw new Error(
            "server.handleUpgrade() was called more than once with the same socket, possibly due to a misconfiguration"
          );
        }
        if (this._state > RUNNING) return abortHandshake(socket, 503);
        const digest = createHash("sha1").update(key + GUID).digest("base64");
        const headers = [
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Accept: ${digest}`
        ];
        const ws = new this.options.WebSocket(null, void 0, this.options);
        if (protocols.size) {
          const protocol = this.options.handleProtocols ? this.options.handleProtocols(protocols, req) : protocols.values().next().value;
          if (protocol) {
            headers.push(`Sec-WebSocket-Protocol: ${protocol}`);
            ws._protocol = protocol;
          }
        }
        if (extensions[PerMessageDeflate2.extensionName]) {
          const params = extensions[PerMessageDeflate2.extensionName].params;
          const value = extension2.format({
            [PerMessageDeflate2.extensionName]: [params]
          });
          headers.push(`Sec-WebSocket-Extensions: ${value}`);
          ws._extensions = extensions;
        }
        this.emit("headers", headers, req);
        socket.write(headers.concat("\r\n").join("\r\n"));
        socket.removeListener("error", socketOnError);
        ws.setSocket(socket, head, {
          allowSynchronousEvents: this.options.allowSynchronousEvents,
          maxBufferedChunks: this.options.maxBufferedChunks,
          maxFragments: this.options.maxFragments,
          maxPayload: this.options.maxPayload,
          skipUTF8Validation: this.options.skipUTF8Validation
        });
        if (this.clients) {
          this.clients.add(ws);
          ws.on("close", () => {
            this.clients.delete(ws);
            if (this._shouldEmitClose && !this.clients.size) {
              process.nextTick(emitClose, this);
            }
          });
        }
        cb(ws, req);
      }
    };
    module.exports = WebSocketServer2;
    function addListeners(server, map) {
      for (const event of Object.keys(map)) server.on(event, map[event]);
      return function removeListeners() {
        for (const event of Object.keys(map)) {
          server.removeListener(event, map[event]);
        }
      };
    }
    function emitClose(server) {
      server._state = CLOSED;
      server.emit("close");
    }
    function socketOnError() {
      this.destroy();
    }
    function abortHandshake(socket, code, message, headers) {
      message = message || http3.STATUS_CODES[code];
      headers = {
        Connection: "close",
        "Content-Type": "text/html",
        "Content-Length": Buffer.byteLength(message),
        ...headers
      };
      socket.once("finish", socket.destroy);
      socket.end(
        `HTTP/1.1 ${code} ${http3.STATUS_CODES[code]}\r
` + Object.keys(headers).map((h) => `${h}: ${headers[h]}`).join("\r\n") + "\r\n\r\n" + message
      );
    }
    function abortHandshakeOrEmitwsClientError(server, req, socket, code, message, headers) {
      if (server.listenerCount("wsClientError")) {
        const err = new Error(message);
        Error.captureStackTrace(err, abortHandshakeOrEmitwsClientError);
        server.emit("wsClientError", err, socket, req);
      } else {
        abortHandshake(socket, code, message, headers);
      }
    }
  }
});

// node_modules/ms/index.js
var require_ms = __commonJS({
  "node_modules/ms/index.js"(exports, module) {
    var s = 1e3;
    var m = s * 60;
    var h = m * 60;
    var d = h * 24;
    var w = d * 7;
    var y = d * 365.25;
    module.exports = function(val, options) {
      options = options || {};
      var type = typeof val;
      if (type === "string" && val.length > 0) {
        return parse(val);
      } else if (type === "number" && isFinite(val)) {
        return options.long ? fmtLong(val) : fmtShort(val);
      }
      throw new Error(
        "val is not a non-empty string or a valid number. val=" + JSON.stringify(val)
      );
    };
    function parse(str) {
      str = String(str);
      if (str.length > 100) {
        return;
      }
      var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
        str
      );
      if (!match) {
        return;
      }
      var n = parseFloat(match[1]);
      var type = (match[2] || "ms").toLowerCase();
      switch (type) {
        case "years":
        case "year":
        case "yrs":
        case "yr":
        case "y":
          return n * y;
        case "weeks":
        case "week":
        case "w":
          return n * w;
        case "days":
        case "day":
        case "d":
          return n * d;
        case "hours":
        case "hour":
        case "hrs":
        case "hr":
        case "h":
          return n * h;
        case "minutes":
        case "minute":
        case "mins":
        case "min":
        case "m":
          return n * m;
        case "seconds":
        case "second":
        case "secs":
        case "sec":
        case "s":
          return n * s;
        case "milliseconds":
        case "millisecond":
        case "msecs":
        case "msec":
        case "ms":
          return n;
        default:
          return void 0;
      }
    }
    function fmtShort(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return Math.round(ms / d) + "d";
      }
      if (msAbs >= h) {
        return Math.round(ms / h) + "h";
      }
      if (msAbs >= m) {
        return Math.round(ms / m) + "m";
      }
      if (msAbs >= s) {
        return Math.round(ms / s) + "s";
      }
      return ms + "ms";
    }
    function fmtLong(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return plural(ms, msAbs, d, "day");
      }
      if (msAbs >= h) {
        return plural(ms, msAbs, h, "hour");
      }
      if (msAbs >= m) {
        return plural(ms, msAbs, m, "minute");
      }
      if (msAbs >= s) {
        return plural(ms, msAbs, s, "second");
      }
      return ms + " ms";
    }
    function plural(ms, msAbs, n, name2) {
      var isPlural = msAbs >= n * 1.5;
      return Math.round(ms / n) + " " + name2 + (isPlural ? "s" : "");
    }
  }
});

// node_modules/debug/src/common.js
var require_common = __commonJS({
  "node_modules/debug/src/common.js"(exports, module) {
    function setup(env) {
      createDebug.debug = createDebug;
      createDebug.default = createDebug;
      createDebug.coerce = coerce;
      createDebug.disable = disable;
      createDebug.enable = enable;
      createDebug.enabled = enabled;
      createDebug.humanize = require_ms();
      createDebug.destroy = destroy;
      Object.keys(env).forEach((key) => {
        createDebug[key] = env[key];
      });
      createDebug.names = [];
      createDebug.skips = [];
      createDebug.formatters = {};
      function selectColor(namespace) {
        let hash = 0;
        for (let i = 0; i < namespace.length; i++) {
          hash = (hash << 5) - hash + namespace.charCodeAt(i);
          hash |= 0;
        }
        return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
      }
      createDebug.selectColor = selectColor;
      function createDebug(namespace) {
        let prevTime;
        let enableOverride = null;
        let namespacesCache;
        let enabledCache;
        function debug(...args) {
          if (!debug.enabled) {
            return;
          }
          const self = debug;
          const curr = Number(/* @__PURE__ */ new Date());
          const ms = curr - (prevTime || curr);
          self.diff = ms;
          self.prev = prevTime;
          self.curr = curr;
          prevTime = curr;
          args[0] = createDebug.coerce(args[0]);
          if (typeof args[0] !== "string") {
            args.unshift("%O");
          }
          let index = 0;
          args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
            if (match === "%%") {
              return "%";
            }
            index++;
            const formatter = createDebug.formatters[format];
            if (typeof formatter === "function") {
              const val = args[index];
              match = formatter.call(self, val);
              args.splice(index, 1);
              index--;
            }
            return match;
          });
          createDebug.formatArgs.call(self, args);
          const logFn = self.log || createDebug.log;
          logFn.apply(self, args);
        }
        debug.namespace = namespace;
        debug.useColors = createDebug.useColors();
        debug.color = createDebug.selectColor(namespace);
        debug.extend = extend;
        debug.destroy = createDebug.destroy;
        Object.defineProperty(debug, "enabled", {
          enumerable: true,
          configurable: false,
          get: () => {
            if (enableOverride !== null) {
              return enableOverride;
            }
            if (namespacesCache !== createDebug.namespaces) {
              namespacesCache = createDebug.namespaces;
              enabledCache = createDebug.enabled(namespace);
            }
            return enabledCache;
          },
          set: (v) => {
            enableOverride = v;
          }
        });
        if (typeof createDebug.init === "function") {
          createDebug.init(debug);
        }
        return debug;
      }
      function extend(namespace, delimiter) {
        const newDebug = createDebug(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
        newDebug.log = this.log;
        return newDebug;
      }
      function enable(namespaces) {
        createDebug.save(namespaces);
        createDebug.namespaces = namespaces;
        createDebug.names = [];
        createDebug.skips = [];
        const split = (typeof namespaces === "string" ? namespaces : "").trim().replace(/\s+/g, ",").split(",").filter(Boolean);
        for (const ns of split) {
          if (ns[0] === "-") {
            createDebug.skips.push(ns.slice(1));
          } else {
            createDebug.names.push(ns);
          }
        }
      }
      function matchesTemplate(search, template) {
        let searchIndex = 0;
        let templateIndex = 0;
        let starIndex = -1;
        let matchIndex = 0;
        while (searchIndex < search.length) {
          if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === "*")) {
            if (template[templateIndex] === "*") {
              starIndex = templateIndex;
              matchIndex = searchIndex;
              templateIndex++;
            } else {
              searchIndex++;
              templateIndex++;
            }
          } else if (starIndex !== -1) {
            templateIndex = starIndex + 1;
            matchIndex++;
            searchIndex = matchIndex;
          } else {
            return false;
          }
        }
        while (templateIndex < template.length && template[templateIndex] === "*") {
          templateIndex++;
        }
        return templateIndex === template.length;
      }
      function disable() {
        const namespaces = [
          ...createDebug.names,
          ...createDebug.skips.map((namespace) => "-" + namespace)
        ].join(",");
        createDebug.enable("");
        return namespaces;
      }
      function enabled(name2) {
        for (const skip of createDebug.skips) {
          if (matchesTemplate(name2, skip)) {
            return false;
          }
        }
        for (const ns of createDebug.names) {
          if (matchesTemplate(name2, ns)) {
            return true;
          }
        }
        return false;
      }
      function coerce(val) {
        if (val instanceof Error) {
          return val.stack || val.message;
        }
        return val;
      }
      function destroy() {
        console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
      }
      createDebug.enable(createDebug.load());
      return createDebug;
    }
    module.exports = setup;
  }
});

// node_modules/debug/src/browser.js
var require_browser = __commonJS({
  "node_modules/debug/src/browser.js"(exports, module) {
    exports.formatArgs = formatArgs;
    exports.save = save;
    exports.load = load;
    exports.useColors = useColors;
    exports.storage = localstorage();
    exports.destroy = /* @__PURE__ */ (() => {
      let warned = false;
      return () => {
        if (!warned) {
          warned = true;
          console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
        }
      };
    })();
    exports.colors = [
      "#0000CC",
      "#0000FF",
      "#0033CC",
      "#0033FF",
      "#0066CC",
      "#0066FF",
      "#0099CC",
      "#0099FF",
      "#00CC00",
      "#00CC33",
      "#00CC66",
      "#00CC99",
      "#00CCCC",
      "#00CCFF",
      "#3300CC",
      "#3300FF",
      "#3333CC",
      "#3333FF",
      "#3366CC",
      "#3366FF",
      "#3399CC",
      "#3399FF",
      "#33CC00",
      "#33CC33",
      "#33CC66",
      "#33CC99",
      "#33CCCC",
      "#33CCFF",
      "#6600CC",
      "#6600FF",
      "#6633CC",
      "#6633FF",
      "#66CC00",
      "#66CC33",
      "#9900CC",
      "#9900FF",
      "#9933CC",
      "#9933FF",
      "#99CC00",
      "#99CC33",
      "#CC0000",
      "#CC0033",
      "#CC0066",
      "#CC0099",
      "#CC00CC",
      "#CC00FF",
      "#CC3300",
      "#CC3333",
      "#CC3366",
      "#CC3399",
      "#CC33CC",
      "#CC33FF",
      "#CC6600",
      "#CC6633",
      "#CC9900",
      "#CC9933",
      "#CCCC00",
      "#CCCC33",
      "#FF0000",
      "#FF0033",
      "#FF0066",
      "#FF0099",
      "#FF00CC",
      "#FF00FF",
      "#FF3300",
      "#FF3333",
      "#FF3366",
      "#FF3399",
      "#FF33CC",
      "#FF33FF",
      "#FF6600",
      "#FF6633",
      "#FF9900",
      "#FF9933",
      "#FFCC00",
      "#FFCC33"
    ];
    function useColors() {
      if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
        return true;
      }
      if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
        return false;
      }
      let m;
      return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || // Is firebug? http://stackoverflow.com/a/398120/376773
      typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || // Is firefox >= v31?
      // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
      typeof navigator !== "undefined" && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || // Double check webkit in userAgent just in case we are in a worker
      typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
    }
    function formatArgs(args) {
      args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module.exports.humanize(this.diff);
      if (!this.useColors) {
        return;
      }
      const c = "color: " + this.color;
      args.splice(1, 0, c, "color: inherit");
      let index = 0;
      let lastC = 0;
      args[0].replace(/%[a-zA-Z%]/g, (match) => {
        if (match === "%%") {
          return;
        }
        index++;
        if (match === "%c") {
          lastC = index;
        }
      });
      args.splice(lastC, 0, c);
    }
    exports.log = console.debug || console.log || (() => {
    });
    function save(namespaces) {
      try {
        if (namespaces) {
          exports.storage.setItem("debug", namespaces);
        } else {
          exports.storage.removeItem("debug");
        }
      } catch (error) {
      }
    }
    function load() {
      let r;
      try {
        r = exports.storage.getItem("debug") || exports.storage.getItem("DEBUG");
      } catch (error) {
      }
      if (!r && typeof process !== "undefined" && "env" in process) {
        r = process.env.DEBUG;
      }
      return r;
    }
    function localstorage() {
      try {
        return localStorage;
      } catch (error) {
      }
    }
    module.exports = require_common()(exports);
    var { formatters } = module.exports;
    formatters.j = function(v) {
      try {
        return JSON.stringify(v);
      } catch (error) {
        return "[UnexpectedJSONParseError]: " + error.message;
      }
    };
  }
});

// node_modules/debug/src/node.js
var require_node = __commonJS({
  "node_modules/debug/src/node.js"(exports, module) {
    var tty = __require("tty");
    var util = __require("util");
    exports.init = init;
    exports.log = log;
    exports.formatArgs = formatArgs;
    exports.save = save;
    exports.load = load;
    exports.useColors = useColors;
    exports.destroy = util.deprecate(
      () => {
      },
      "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`."
    );
    exports.colors = [6, 2, 3, 4, 5, 1];
    try {
      const supportsColor = __require("supports-color");
      if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
        exports.colors = [
          20,
          21,
          26,
          27,
          32,
          33,
          38,
          39,
          40,
          41,
          42,
          43,
          44,
          45,
          56,
          57,
          62,
          63,
          68,
          69,
          74,
          75,
          76,
          77,
          78,
          79,
          80,
          81,
          92,
          93,
          98,
          99,
          112,
          113,
          128,
          129,
          134,
          135,
          148,
          149,
          160,
          161,
          162,
          163,
          164,
          165,
          166,
          167,
          168,
          169,
          170,
          171,
          172,
          173,
          178,
          179,
          184,
          185,
          196,
          197,
          198,
          199,
          200,
          201,
          202,
          203,
          204,
          205,
          206,
          207,
          208,
          209,
          214,
          215,
          220,
          221
        ];
      }
    } catch (error) {
    }
    exports.inspectOpts = Object.keys(process.env).filter((key) => {
      return /^debug_/i.test(key);
    }).reduce((obj, key) => {
      const prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, (_, k) => {
        return k.toUpperCase();
      });
      let val = process.env[key];
      if (/^(yes|on|true|enabled)$/i.test(val)) {
        val = true;
      } else if (/^(no|off|false|disabled)$/i.test(val)) {
        val = false;
      } else if (val === "null") {
        val = null;
      } else {
        val = Number(val);
      }
      obj[prop] = val;
      return obj;
    }, {});
    function useColors() {
      return "colors" in exports.inspectOpts ? Boolean(exports.inspectOpts.colors) : tty.isatty(process.stderr.fd);
    }
    function formatArgs(args) {
      const { namespace: name2, useColors: useColors2 } = this;
      if (useColors2) {
        const c = this.color;
        const colorCode = "\x1B[3" + (c < 8 ? c : "8;5;" + c);
        const prefix = `  ${colorCode};1m${name2} \x1B[0m`;
        args[0] = prefix + args[0].split("\n").join("\n" + prefix);
        args.push(colorCode + "m+" + module.exports.humanize(this.diff) + "\x1B[0m");
      } else {
        args[0] = getDate() + name2 + " " + args[0];
      }
    }
    function getDate() {
      if (exports.inspectOpts.hideDate) {
        return "";
      }
      return (/* @__PURE__ */ new Date()).toISOString() + " ";
    }
    function log(...args) {
      return process.stderr.write(util.formatWithOptions(exports.inspectOpts, ...args) + "\n");
    }
    function save(namespaces) {
      if (namespaces) {
        process.env.DEBUG = namespaces;
      } else {
        delete process.env.DEBUG;
      }
    }
    function load() {
      return process.env.DEBUG;
    }
    function init(debug) {
      debug.inspectOpts = {};
      const keys = Object.keys(exports.inspectOpts);
      for (let i = 0; i < keys.length; i++) {
        debug.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
      }
    }
    module.exports = require_common()(exports);
    var { formatters } = module.exports;
    formatters.o = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts).split("\n").map((str) => str.trim()).join(" ");
    };
    formatters.O = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts);
    };
  }
});

// node_modules/debug/src/index.js
var require_src = __commonJS({
  "node_modules/debug/src/index.js"(exports, module) {
    if (typeof process === "undefined" || process.type === "renderer" || process.browser === true || process.__nwjs) {
      module.exports = require_browser();
    } else {
      module.exports = require_node();
    }
  }
});

// node_modules/agent-base/dist/helpers.js
var require_helpers = __commonJS({
  "node_modules/agent-base/dist/helpers.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports && exports.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports && exports.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.req = exports.json = exports.toBuffer = void 0;
    var http3 = __importStar(__require("http"));
    var https2 = __importStar(__require("https"));
    async function toBuffer(stream) {
      let length = 0;
      const chunks = [];
      for await (const chunk of stream) {
        length += chunk.length;
        chunks.push(chunk);
      }
      return Buffer.concat(chunks, length);
    }
    exports.toBuffer = toBuffer;
    async function json2(stream) {
      const buf = await toBuffer(stream);
      const str = buf.toString("utf8");
      try {
        return JSON.parse(str);
      } catch (_err) {
        const err = _err;
        err.message += ` (input: ${str})`;
        throw err;
      }
    }
    exports.json = json2;
    function req(url, opts = {}) {
      const href = typeof url === "string" ? url : url.href;
      const req2 = (href.startsWith("https:") ? https2 : http3).request(url, opts);
      const promise = new Promise((resolve, reject) => {
        req2.once("response", resolve).once("error", reject).end();
      });
      req2.then = promise.then.bind(promise);
      return req2;
    }
    exports.req = req;
  }
});

// node_modules/agent-base/dist/index.js
var require_dist = __commonJS({
  "node_modules/agent-base/dist/index.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports && exports.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports && exports.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p)) __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Agent = void 0;
    var net3 = __importStar(__require("net"));
    var http3 = __importStar(__require("http"));
    var https_1 = __require("https");
    __exportStar(require_helpers(), exports);
    var INTERNAL = Symbol("AgentBaseInternalState");
    var Agent = class extends http3.Agent {
      constructor(opts) {
        super(opts);
        this[INTERNAL] = {};
      }
      /**
       * Determine whether this is an `http` or `https` request.
       */
      isSecureEndpoint(options) {
        if (options) {
          if (typeof options.secureEndpoint === "boolean") {
            return options.secureEndpoint;
          }
          if (typeof options.protocol === "string") {
            return options.protocol === "https:";
          }
        }
        const { stack } = new Error();
        if (typeof stack !== "string")
          return false;
        return stack.split("\n").some((l) => l.indexOf("(https.js:") !== -1 || l.indexOf("node:https:") !== -1);
      }
      // In order to support async signatures in `connect()` and Node's native
      // connection pooling in `http.Agent`, the array of sockets for each origin
      // has to be updated synchronously. This is so the length of the array is
      // accurate when `addRequest()` is next called. We achieve this by creating a
      // fake socket and adding it to `sockets[origin]` and incrementing
      // `totalSocketCount`.
      incrementSockets(name2) {
        if (this.maxSockets === Infinity && this.maxTotalSockets === Infinity) {
          return null;
        }
        if (!this.sockets[name2]) {
          this.sockets[name2] = [];
        }
        const fakeSocket = new net3.Socket({ writable: false });
        this.sockets[name2].push(fakeSocket);
        this.totalSocketCount++;
        return fakeSocket;
      }
      decrementSockets(name2, socket) {
        if (!this.sockets[name2] || socket === null) {
          return;
        }
        const sockets = this.sockets[name2];
        const index = sockets.indexOf(socket);
        if (index !== -1) {
          sockets.splice(index, 1);
          this.totalSocketCount--;
          if (sockets.length === 0) {
            delete this.sockets[name2];
          }
        }
      }
      // In order to properly update the socket pool, we need to call `getName()` on
      // the core `https.Agent` if it is a secureEndpoint.
      getName(options) {
        const secureEndpoint = this.isSecureEndpoint(options);
        if (secureEndpoint) {
          return https_1.Agent.prototype.getName.call(this, options);
        }
        return super.getName(options);
      }
      createSocket(req, options, cb) {
        const connectOpts = {
          ...options,
          secureEndpoint: this.isSecureEndpoint(options)
        };
        const name2 = this.getName(connectOpts);
        const fakeSocket = this.incrementSockets(name2);
        Promise.resolve().then(() => this.connect(req, connectOpts)).then((socket) => {
          this.decrementSockets(name2, fakeSocket);
          if (socket instanceof http3.Agent) {
            try {
              return socket.addRequest(req, connectOpts);
            } catch (err) {
              return cb(err);
            }
          }
          this[INTERNAL].currentSocket = socket;
          super.createSocket(req, options, cb);
        }, (err) => {
          this.decrementSockets(name2, fakeSocket);
          cb(err);
        });
      }
      createConnection() {
        const socket = this[INTERNAL].currentSocket;
        this[INTERNAL].currentSocket = void 0;
        if (!socket) {
          throw new Error("No socket was returned in the `connect()` function");
        }
        return socket;
      }
      get defaultPort() {
        return this[INTERNAL].defaultPort ?? (this.protocol === "https:" ? 443 : 80);
      }
      set defaultPort(v) {
        if (this[INTERNAL]) {
          this[INTERNAL].defaultPort = v;
        }
      }
      get protocol() {
        return this[INTERNAL].protocol ?? (this.isSecureEndpoint() ? "https:" : "http:");
      }
      set protocol(v) {
        if (this[INTERNAL]) {
          this[INTERNAL].protocol = v;
        }
      }
    };
    exports.Agent = Agent;
  }
});

// node_modules/https-proxy-agent/dist/parse-proxy-response.js
var require_parse_proxy_response = __commonJS({
  "node_modules/https-proxy-agent/dist/parse-proxy-response.js"(exports) {
    "use strict";
    var __importDefault = exports && exports.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.parseProxyResponse = void 0;
    var debug_1 = __importDefault(require_src());
    var debug = (0, debug_1.default)("https-proxy-agent:parse-proxy-response");
    function parseProxyResponse(socket) {
      return new Promise((resolve, reject) => {
        let buffersLength = 0;
        const buffers = [];
        function read() {
          const b = socket.read();
          if (b)
            ondata(b);
          else
            socket.once("readable", read);
        }
        function cleanup() {
          socket.removeListener("end", onend);
          socket.removeListener("error", onerror);
          socket.removeListener("readable", read);
        }
        function onend() {
          cleanup();
          debug("onend");
          reject(new Error("Proxy connection ended before receiving CONNECT response"));
        }
        function onerror(err) {
          cleanup();
          debug("onerror %o", err);
          reject(err);
        }
        function ondata(b) {
          buffers.push(b);
          buffersLength += b.length;
          const buffered = Buffer.concat(buffers, buffersLength);
          const endOfHeaders = buffered.indexOf("\r\n\r\n");
          if (endOfHeaders === -1) {
            debug("have not received end of HTTP headers yet...");
            read();
            return;
          }
          const headerParts = buffered.slice(0, endOfHeaders).toString("ascii").split("\r\n");
          const firstLine = headerParts.shift();
          if (!firstLine) {
            socket.destroy();
            return reject(new Error("No header received from proxy CONNECT response"));
          }
          const firstLineParts = firstLine.split(" ");
          const statusCode = +firstLineParts[1];
          const statusText = firstLineParts.slice(2).join(" ");
          const headers = {};
          for (const header of headerParts) {
            if (!header)
              continue;
            const firstColon = header.indexOf(":");
            if (firstColon === -1) {
              socket.destroy();
              return reject(new Error(`Invalid header from proxy CONNECT response: "${header}"`));
            }
            const key = header.slice(0, firstColon).toLowerCase();
            const value = header.slice(firstColon + 1).trimStart();
            const current = headers[key];
            if (typeof current === "string") {
              headers[key] = [current, value];
            } else if (Array.isArray(current)) {
              current.push(value);
            } else {
              headers[key] = value;
            }
          }
          debug("got proxy server response: %o %o", firstLine, headers);
          cleanup();
          resolve({
            connect: {
              statusCode,
              statusText,
              headers
            },
            buffered
          });
        }
        socket.on("error", onerror);
        socket.on("end", onend);
        read();
      });
    }
    exports.parseProxyResponse = parseProxyResponse;
  }
});

// node_modules/https-proxy-agent/dist/index.js
var require_dist2 = __commonJS({
  "node_modules/https-proxy-agent/dist/index.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports && exports.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports && exports.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    var __importDefault = exports && exports.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.HttpsProxyAgent = void 0;
    var net3 = __importStar(__require("net"));
    var tls = __importStar(__require("tls"));
    var assert_1 = __importDefault(__require("assert"));
    var debug_1 = __importDefault(require_src());
    var agent_base_1 = require_dist();
    var url_1 = __require("url");
    var parse_proxy_response_1 = require_parse_proxy_response();
    var debug = (0, debug_1.default)("https-proxy-agent");
    var setServernameFromNonIpHost = (options) => {
      if (options.servername === void 0 && options.host && !net3.isIP(options.host)) {
        return {
          ...options,
          servername: options.host
        };
      }
      return options;
    };
    var HttpsProxyAgent2 = class extends agent_base_1.Agent {
      constructor(proxy, opts) {
        super(opts);
        this.options = { path: void 0 };
        this.proxy = typeof proxy === "string" ? new url_1.URL(proxy) : proxy;
        this.proxyHeaders = opts?.headers ?? {};
        debug("Creating new HttpsProxyAgent instance: %o", this.proxy.href);
        const host = (this.proxy.hostname || this.proxy.host).replace(/^\[|\]$/g, "");
        const port = this.proxy.port ? parseInt(this.proxy.port, 10) : this.proxy.protocol === "https:" ? 443 : 80;
        this.connectOpts = {
          // Attempt to negotiate http/1.1 for proxy servers that support http/2
          ALPNProtocols: ["http/1.1"],
          ...opts ? omit(opts, "headers") : null,
          host,
          port
        };
      }
      /**
       * Called when the node-core HTTP client library is creating a
       * new HTTP request.
       */
      async connect(req, opts) {
        const { proxy } = this;
        if (!opts.host) {
          throw new TypeError('No "host" provided');
        }
        let socket;
        if (proxy.protocol === "https:") {
          debug("Creating `tls.Socket`: %o", this.connectOpts);
          socket = tls.connect(setServernameFromNonIpHost(this.connectOpts));
        } else {
          debug("Creating `net.Socket`: %o", this.connectOpts);
          socket = net3.connect(this.connectOpts);
        }
        const headers = typeof this.proxyHeaders === "function" ? this.proxyHeaders() : { ...this.proxyHeaders };
        const host = net3.isIPv6(opts.host) ? `[${opts.host}]` : opts.host;
        let payload = `CONNECT ${host}:${opts.port} HTTP/1.1\r
`;
        if (proxy.username || proxy.password) {
          const auth = `${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`;
          headers["Proxy-Authorization"] = `Basic ${Buffer.from(auth).toString("base64")}`;
        }
        headers.Host = `${host}:${opts.port}`;
        if (!headers["Proxy-Connection"]) {
          headers["Proxy-Connection"] = this.keepAlive ? "Keep-Alive" : "close";
        }
        for (const name2 of Object.keys(headers)) {
          payload += `${name2}: ${headers[name2]}\r
`;
        }
        const proxyResponsePromise = (0, parse_proxy_response_1.parseProxyResponse)(socket);
        socket.write(`${payload}\r
`);
        const { connect, buffered } = await proxyResponsePromise;
        req.emit("proxyConnect", connect);
        this.emit("proxyConnect", connect, req);
        if (connect.statusCode === 200) {
          req.once("socket", resume);
          if (opts.secureEndpoint) {
            debug("Upgrading socket connection to TLS");
            return tls.connect({
              ...omit(setServernameFromNonIpHost(opts), "host", "path", "port"),
              socket
            });
          }
          return socket;
        }
        socket.destroy();
        const fakeSocket = new net3.Socket({ writable: false });
        fakeSocket.readable = true;
        req.once("socket", (s) => {
          debug("Replaying proxy buffer for failed request");
          (0, assert_1.default)(s.listenerCount("data") > 0);
          s.push(buffered);
          s.push(null);
        });
        return fakeSocket;
      }
    };
    HttpsProxyAgent2.protocols = ["http", "https"];
    exports.HttpsProxyAgent = HttpsProxyAgent2;
    function resume(socket) {
      socket.resume();
    }
    function omit(obj, ...keys) {
      const ret = {};
      let key;
      for (key in obj) {
        if (!keys.includes(key)) {
          ret[key] = obj[key];
        }
      }
      return ret;
    }
  }
});

// src/index.ts
import { readFileSync as readFileSync3, writeFileSync as writeFileSync3, mkdirSync as mkdirSync2 } from "node:fs";
import { dirname as dirname2, join as join2 } from "node:path";
import { fileURLToPath } from "node:url";
import os2 from "node:os";

// src/link.ts
import { EventEmitter as EventEmitter2 } from "node:events";
import net2 from "node:net";
import http2 from "node:http";
import os from "node:os";

// node_modules/ws/wrapper.mjs
var import_stream = __toESM(require_stream(), 1);
var import_extension = __toESM(require_extension(), 1);
var import_permessage_deflate = __toESM(require_permessage_deflate(), 1);
var import_receiver = __toESM(require_receiver(), 1);
var import_sender = __toESM(require_sender(), 1);
var import_subprotocol = __toESM(require_subprotocol(), 1);
var import_websocket = __toESM(require_websocket(), 1);
var import_websocket_server = __toESM(require_websocket_server(), 1);
var wrapper_default = import_websocket.default;

// src/mux.ts
import { Duplex } from "node:stream";
import { EventEmitter } from "node:events";
var T_DATA = 0;
var T_WINDOW = 1;
var T_PING = 2;
var T_GOAWAY = 3;
var F_SYN = 1;
var F_ACK = 2;
var F_FIN = 4;
var F_RST = 8;
var INITIAL_WINDOW = 256 * 1024;
var MAX_CHUNK = 64 * 1024;
function encodeHeader(type, flags, id, length) {
  const b = Buffer.alloc(12);
  b[0] = 0;
  b[1] = type;
  b.writeUInt16BE(flags, 2);
  b.writeUInt32BE(id >>> 0, 4);
  b.writeUInt32BE(length >>> 0, 8);
  return b;
}
var MuxStream = class extends Duplex {
  constructor(session, id) {
    super({ allowHalfOpen: true, highWaterMark: 64 * 1024 });
    this.session = session;
    this.id = id;
  }
  sendWindow = INITIAL_WINDOW;
  recvWindow = INITIAL_WINDOW;
  unacked = 0;
  queue = [];
  finalCb = null;
  localClosed = false;
  remoteClosed = false;
  reset = false;
  _write(chunk, _enc, cb) {
    if (this.reset) return cb(new Error("stream reset"));
    this.queue.push({ buf: Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk), cb });
    this.flush();
  }
  flush() {
    while (this.queue.length && this.sendWindow > 0 && !this.reset) {
      const q = this.queue[0];
      const n = Math.min(q.buf.length, this.sendWindow, MAX_CHUNK);
      this.session.frame(T_DATA, 0, this.id, q.buf.subarray(0, n));
      this.sendWindow -= n;
      if (n === q.buf.length) {
        this.queue.shift();
        q.cb();
      } else q.buf = q.buf.subarray(n);
    }
    if (!this.queue.length && this.finalCb) {
      const cb = this.finalCb;
      this.finalCb = null;
      this.sendFin();
      cb();
    }
  }
  sendFin() {
    if (this.localClosed || this.reset) return;
    this.localClosed = true;
    this.session.frame(T_WINDOW, F_FIN, this.id);
    this.maybeGone();
  }
  _final(cb) {
    this.finalCb = cb;
    this.flush();
  }
  _read() {
    if (this.unacked > 0 && !this.reset && !this.remoteClosed) {
      const d = this.unacked;
      this.unacked = 0;
      this.recvWindow += d;
      this.session.frame(T_WINDOW, 0, this.id, void 0, d);
    }
  }
  _destroy(err, cb) {
    if (!this.reset && !(this.localClosed && this.remoteClosed)) {
      this.reset = true;
      this.session.frame(T_WINDOW, F_RST, this.id);
    }
    for (const q of this.queue) q.cb(new Error("stream destroyed"));
    this.queue = [];
    this.session.forget(this.id);
    cb(err);
  }
  onData(buf) {
    if (buf.length > this.recvWindow) {
      this.session.protocolError("receive window exceeded");
      return;
    }
    this.recvWindow -= buf.length;
    this.unacked += buf.length;
    if (!this.remoteClosed) this.push(buf);
  }
  onWindow(delta) {
    this.sendWindow += delta;
    this.flush();
  }
  onFlags(flags) {
    if (flags & F_RST) {
      this.reset = true;
      this.remoteClosed = true;
      this.localClosed = true;
      this.destroy();
      return;
    }
    if (flags & F_FIN) {
      if (!this.remoteClosed) {
        this.remoteClosed = true;
        this.push(null);
      }
      this.maybeGone();
    }
  }
  maybeGone() {
    if (this.localClosed && this.remoteClosed) this.session.forget(this.id);
  }
};
var MuxSession = class extends EventEmitter {
  constructor(t) {
    super();
    this.t = t;
  }
  streams = /* @__PURE__ */ new Map();
  nextId = 1;
  // client: odd ids
  buf = Buffer.alloc(0);
  pingId = 0;
  pings = /* @__PURE__ */ new Map();
  closed = false;
  maxStreams = 256;
  frame(type, flags, id, payload, length) {
    if (this.closed) return;
    const len = payload ? payload.length : length || 0;
    const h = encodeHeader(type, flags, id, len);
    this.t.send(payload && payload.length ? Buffer.concat([h, payload]) : h);
  }
  open() {
    if (this.closed) throw new Error("session closed");
    const id = this.nextId;
    this.nextId += 2;
    const s = new MuxStream(this, id);
    this.streams.set(id, s);
    this.frame(T_WINDOW, F_SYN, id, void 0, 0);
    return s;
  }
  ping(timeoutMs = 45e3) {
    const id = ++this.pingId >>> 0;
    const start = Date.now();
    return new Promise((res, rej) => {
      const t = setTimeout(() => {
        this.pings.delete(id);
        rej(new Error("ping timeout"));
      }, timeoutMs);
      t.unref?.();
      this.pings.set(id, () => {
        clearTimeout(t);
        res(Date.now() - start);
      });
      this.frame(T_PING, F_SYN, 0, void 0, id);
    });
  }
  forget(id) {
    this.streams.delete(id);
  }
  get streamCount() {
    return this.streams.size;
  }
  feed(chunk) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    while (this.buf.length >= 12 && !this.closed) {
      const ver = this.buf[0], type = this.buf[1], flags = this.buf.readUInt16BE(2), id = this.buf.readUInt32BE(4), len = this.buf.readUInt32BE(8);
      if (ver !== 0) return this.protocolError("bad version");
      const need = type === T_DATA ? 12 + len : 12;
      if (type === T_DATA && len > INITIAL_WINDOW * 4) return this.protocolError("frame too large");
      if (this.buf.length < need) return;
      const payload = type === T_DATA ? this.buf.subarray(12, need) : null;
      this.buf = this.buf.subarray(need);
      this.handle(type, flags, id, len, payload);
    }
  }
  handle(type, flags, id, len, payload) {
    if (type === T_PING) {
      if (flags & F_SYN) this.frame(T_PING, F_ACK, 0, void 0, len);
      else if (flags & F_ACK) {
        const cb = this.pings.get(len);
        if (cb) {
          this.pings.delete(len);
          cb(0);
        }
      }
      return;
    }
    if (type === T_GOAWAY) {
      this.close(new Error("remote goaway"));
      return;
    }
    if (type !== T_DATA && type !== T_WINDOW) return this.protocolError("bad type");
    let s = this.streams.get(id);
    if (flags & F_SYN) {
      if (s || id % 2 === 1) return this.protocolError("bad SYN");
      if (this.streams.size >= this.maxStreams) {
        this.frame(T_WINDOW, F_RST, id);
        return;
      }
      s = new MuxStream(this, id);
      this.streams.set(id, s);
      this.frame(T_WINDOW, F_ACK, id, void 0, 0);
      this.emit("stream", s);
    }
    if (!s) return;
    if (type === T_WINDOW) s.onWindow(len);
    else if (payload && payload.length) s.onData(Buffer.from(payload));
    s.onFlags(flags);
  }
  protocolError(msg) {
    this.close(new Error("yamux: " + msg));
  }
  close(err) {
    if (this.closed) return;
    try {
      this.frame(T_GOAWAY, 0, 0, void 0, err ? 1 : 0);
    } catch {
    }
    this.closed = true;
    for (const s of [...this.streams.values()]) {
      s.reset = true;
      s.destroy();
    }
    this.streams.clear();
    for (const cb of this.pings.values()) void cb;
    this.pings.clear();
    try {
      this.t.close();
    } catch {
    }
    this.emit("close", err);
  }
};

// src/keystore.ts
import { execFile, spawn } from "node:child_process";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync, generateKeyPairSync, createPrivateKey, createPublicKey, sign } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { hostname } from "node:os";
import { join, dirname } from "node:path";
var SERVICE = "dsh-remote-agent";
var ACCOUNT = "device-key";
function run(cmd, args, input, timeout = 15e3) {
  return new Promise((res) => {
    const c = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    const t = setTimeout(() => c.kill("SIGKILL"), timeout);
    c.stdout.on("data", (d) => out += d);
    c.on("error", () => {
      clearTimeout(t);
      res({ code: -1, out: "" });
    });
    c.on("close", (code) => {
      clearTimeout(t);
      res({ code: code ?? -1, out });
    });
    if (input !== void 0) c.stdin.end(input);
    else c.stdin.end();
  });
}
var KeychainStore = class {
  constructor(bin = "/usr/bin/security") {
    this.bin = bin;
  }
  kind = "keychain";
  async available() {
    return process.platform === "darwin" && existsSync(this.bin);
  }
  async load() {
    const r = await run(this.bin, ["find-generic-password", "-s", SERVICE, "-a", ACCOUNT, "-w"]);
    return r.code === 0 ? r.out.trim() || null : null;
  }
  async save(v) {
    if (!/^[A-Za-z0-9+/=]+$/.test(v)) throw new Error("unexpected key encoding");
    const r = await run(this.bin, ["-i"], `add-generic-password -U -s ${SERVICE} -a ${ACCOUNT} -l "DSH Remote Agent device key" -w ${v}
`);
    if (r.code !== 0) throw new Error("keychain write failed");
    if (await this.load() !== v) throw new Error("keychain verify failed");
  }
  async clear() {
    await run(this.bin, ["delete-generic-password", "-s", SERVICE, "-a", ACCOUNT]);
  }
};
function machineId() {
  return new Promise((res) => {
    if (process.platform === "darwin") {
      execFile("/usr/sbin/ioreg", ["-rd1", "-c", "IOPlatformExpertDevice"], { timeout: 5e3 }, (e, out) => {
        const m = /"IOPlatformUUID" = "([^"]+)"/.exec(String(out || ""));
        res(m ? m[1] : hostname());
      });
      return;
    }
    for (const p of ["/etc/machine-id", "/var/lib/dbus/machine-id"]) {
      try {
        const v = readFileSync(p, "utf8").trim();
        if (v) return res(v);
      } catch {
      }
    }
    res(hostname());
  });
}
var FileStore = class {
  constructor(file, idSource = machineId) {
    this.file = file;
    this.idSource = idSource;
  }
  kind = "file";
  async load() {
    if (!existsSync(this.file)) return null;
    try {
      const j = JSON.parse(readFileSync(this.file, "utf8"));
      const key = scryptSync(await this.idSource(), Buffer.from(j.salt, "base64"), 32);
      const d = createDecipheriv("aes-256-gcm", key, Buffer.from(j.iv, "base64"));
      d.setAuthTag(Buffer.from(j.tag, "base64"));
      return Buffer.concat([d.update(Buffer.from(j.data, "base64")), d.final()]).toString("utf8");
    } catch {
      return null;
    }
  }
  async save(v) {
    const salt = randomBytes(16), iv = randomBytes(12);
    const key = scryptSync(await this.idSource(), salt, 32);
    const c = createCipheriv("aes-256-gcm", key, iv);
    const data = Buffer.concat([c.update(v, "utf8"), c.final()]);
    mkdirSync(dirname(this.file), { recursive: true, mode: 448 });
    writeFileSync(this.file, JSON.stringify({ v: 1, salt: salt.toString("base64"), iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), data: data.toString("base64") }), { mode: 384 });
  }
  async clear() {
    rmSync(this.file, { force: true });
  }
};
async function pickStore(dir, prefer) {
  const kc = new KeychainStore();
  if (prefer !== "file" && await kc.available()) return kc;
  return new FileStore(join(dir, "device-key.enc"));
}
function newDeviceKey() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return { pkcs8: privateKey.export({ type: "pkcs8", format: "der" }).toString("base64"), pub: rawPub(publicKey) };
}
function rawPub(k) {
  const der = k.export({ type: "spki", format: "der" });
  return der.subarray(der.length - 32).toString("base64");
}
function loadKey(pkcs8) {
  const priv = createPrivateKey({ key: Buffer.from(pkcs8, "base64"), format: "der", type: "pkcs8" });
  return { priv, pub: rawPub(createPublicKey(priv)) };
}
function signMsg(priv, msg) {
  return sign(null, Buffer.from(msg), priv).toString("base64");
}

// src/redact.ts
var PATTERNS = [
  /([?&](?:t|token|ticket|code|auth|key|sig)=)[^&\s"']+/gi,
  /\b(authorization|cookie|set-cookie)\s*[:=]\s*[^\n]+/gi,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
  /\b[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}\b/g
];
var known = /* @__PURE__ */ new Set();
function addSecret(s) {
  if (s && s.length >= 6) known.add(s);
}
function redact(input) {
  let s = String(input instanceof Error ? input.message : input);
  for (const k of known) s = s.split(k).join("***");
  s = s.replace(PATTERNS[0], "$1***").replace(PATTERNS[1], "$1: ***").replace(PATTERNS[2], "***").replace(PATTERNS[3], "****-****-****");
  return s;
}

// src/net.ts
var import_https_proxy_agent = __toESM(require_dist2(), 1);
import http from "node:http";
import https from "node:https";
import { execFile as execFile2 } from "node:child_process";
async function resolveProxy(setting, target) {
  const s = (setting || "system").trim();
  if (s === "direct") return null;
  if (/^https?:\/\//.test(s)) return s;
  const host = new URL(target).hostname;
  if (host === "127.0.0.1" || host === "localhost" || host === "::1") return null;
  const np = process.env.NO_PROXY || process.env.no_proxy || "";
  if (np.split(",").map((x) => x.trim()).filter(Boolean).some((d) => d === "*" || host === d.replace(/^\./, "") || host.endsWith("." + d.replace(/^\./, "")))) return null;
  const env = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.ALL_PROXY || process.env.all_proxy;
  if (env && /^https?:\/\//.test(env)) return env;
  if (process.platform !== "darwin") return null;
  return new Promise((res) => execFile2("/usr/sbin/scutil", ["--proxy"], { timeout: 3e3 }, (e, out) => {
    const o = String(out || "");
    const en = /HTTPSEnable\s*:\s*1/.test(o), h = /HTTPSProxy\s*:\s*(\S+)/.exec(o), p = /HTTPSPort\s*:\s*(\d+)/.exec(o);
    res(!e && en && h && p ? `http://${h[1]}:${p[1]}` : null);
  }));
}
function agentFor(proxy) {
  return proxy ? new import_https_proxy_agent.HttpsProxyAgent(proxy) : void 0;
}
function postJSON(url, body, agent, timeout = 15e3) {
  return new Promise((res, rej) => {
    const u = new URL(url);
    const data = Buffer.from(JSON.stringify(body));
    const mod = u.protocol === "https:" ? https : http;
    const req = mod.request(u, { method: "POST", agent, timeout, headers: { "content-type": "application/json", "content-length": data.length } }, (r) => {
      const chunks = [];
      r.on("data", (c) => chunks.push(c));
      r.on("end", () => {
        let j = {};
        try {
          j = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch {
        }
        res({ status: r.statusCode || 0, json: j });
      });
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", rej);
    req.end(data);
  });
}

// src/bridge/types.ts
var AGENT_CAP_VERSION = 4;
var emptyObjectParams = {
  type: "object",
  properties: {},
  additionalProperties: false
};

// src/bridge/catalog.ts
var L0_CATALOG = [
  {
    id: "instance.status",
    title: "\u5B9E\u4F8B\u72B6\u6001",
    description: "\u5728\u7EBF\u3001DSH/\u63D2\u4EF6/OS/Node \u7248\u672C\u3001\u5C31\u7EEA\u6001",
    params: emptyObjectParams,
    stream: false,
    permission: "open",
    sensitive: false,
    minAgentVersion: "0.1.0",
    category: "observe"
  },
  {
    id: "instance.metrics",
    title: "\u5B9E\u65F6\u6307\u6807",
    description: "CPU / \u5185\u5B58 / \u8D1F\u8F7D / RSS",
    params: emptyObjectParams,
    stream: false,
    permission: "open",
    sensitive: false,
    minAgentVersion: "0.1.0",
    category: "observe"
  },
  {
    id: "instance.enrollment",
    title: "\u767B\u8BB0\u6458\u8981",
    description: "\u6307\u7EB9\u524D\u7F00\u3001Hub\u3001\u5EF6\u8FDF\u3001\u8FDE\u63A5\u6001",
    params: emptyObjectParams,
    stream: false,
    permission: "open",
    sensitive: false,
    minAgentVersion: "0.1.0",
    category: "observe"
  },
  {
    id: "instance.logs.tail",
    title: "\u65E5\u5FD7\u5C3E",
    description: "\u8131\u654F\u65E5\u5FD7\u5C3E\uFF08\u73AF\u5F62\u7F13\u51B2\uFF09",
    params: {
      type: "object",
      properties: {
        lines: { type: "integer", minimum: 1, maximum: 500, default: 100 }
      },
      additionalProperties: false
    },
    stream: false,
    permission: "manage",
    sensitive: false,
    minAgentVersion: "0.1.0",
    category: "observe"
  },
  {
    id: "services.health",
    title: "\u672C\u673A\u670D\u52A1\u5065\u5EB7",
    description: "\u767D\u540D\u5355 loopback \u63A2\u6D3B",
    params: emptyObjectParams,
    stream: false,
    permission: "open",
    sensitive: false,
    minAgentVersion: "0.1.0",
    category: "observe"
  },
  {
    id: "dsh.restart",
    title: "\u91CD\u542F DSH",
    description: "\u9700\u672C\u673A\u5141\u8BB8\u8FDC\u7A0B\u91CD\u542F",
    params: {
      type: "object",
      properties: {
        dryRun: { type: "boolean", default: true },
        execute: { type: "boolean", default: false }
      },
      additionalProperties: false
    },
    stream: false,
    permission: "restart",
    sensitive: true,
    minAgentVersion: "0.1.0",
    category: "operate"
  },
  {
    id: "plugin.reload",
    title: "\u91CD\u8F7D\u8FDC\u7A0B\u63D2\u4EF6",
    description: "\u70ED\u91CD\u8F7D dsh-remote-agent\uFF08\u82E5\u8FD0\u884C\u65F6\u652F\u6301\uFF09",
    params: {
      type: "object",
      properties: {
        dryRun: { type: "boolean", default: true },
        execute: { type: "boolean", default: false }
      },
      additionalProperties: false
    },
    stream: false,
    permission: "restart",
    sensitive: true,
    minAgentVersion: "0.1.0",
    category: "operate"
  },
  {
    id: "plugin.update",
    title: "\u5347\u7EA7\u8FDC\u7A0B\u63D2\u4EF6",
    description: "\u9A8C\u7B7E\u540E\u81EA\u5347\u7EA7",
    params: {
      type: "object",
      properties: {
        dryRun: { type: "boolean", default: true },
        execute: { type: "boolean", default: false }
      },
      additionalProperties: false
    },
    stream: false,
    permission: "update",
    sensitive: true,
    minAgentVersion: "0.1.0",
    category: "operate"
  }
];
var sid = { type: "string", minLength: 1, maxLength: 200 };
function l1(id, title, description, properties, required, category, stream = false) {
  return {
    id,
    title,
    description,
    params: { type: "object", properties, required, additionalProperties: false },
    stream,
    permission: "open",
    sensitive: false,
    minAgentVersion: "0.2.0",
    category
  };
}
var L1_CATALOG = [
  l1("chat.sessions.list", "\u4F1A\u8BDD\u5217\u8868", "DSH \u4F1A\u8BDD\u4E0E Spaces\uFF08\u6309\u5DE5\u4F5C\u76EE\u5F55\u5206\u7EC4\uFF09", {}, [], "chat"),
  l1("chat.session.create", "\u65B0\u5EFA\u4F1A\u8BDD", "\u65B0\u5EFA DSH \u4F1A\u8BDD\uFF08\u53EF\u6307\u5B9A cwd\uFF09", { cwd: { type: "string", maxLength: 1e3 } }, [], "chat"),
  l1("chat.session.rename", "\u91CD\u547D\u540D\u4F1A\u8BDD", "\u4FEE\u6539\u4F1A\u8BDD\u6807\u9898", { sessionId: sid, title: { type: "string", minLength: 1, maxLength: 200 } }, ["sessionId", "title"], "chat"),
  l1("chat.session.delete", "\u5220\u9664\u4F1A\u8BDD", "\u5220\u9664\u4E00\u4E2A DSH \u4F1A\u8BDD", { sessionId: sid }, ["sessionId"], "chat"),
  l1("chat.history", "\u4F1A\u8BDD\u5386\u53F2", "\u6309\u9875\u8BFB\u53D6\u4F1A\u8BDD\u6D88\u606F", { sessionId: sid, maxMessages: { type: "integer", minimum: 1, maximum: 200 }, beforeSeq: { type: "integer", minimum: 0 } }, ["sessionId"], "chat"),
  l1("chat.prompt", "\u53D1\u9001\u6D88\u606F", "\u5411\u4F1A\u8BDD\u53D1\u9001\u4E00\u6761\u6D88\u606F\uFF08\u9A71\u52A8 DSH agent loop\uFF09", { sessionId: sid, text: { type: "string", minLength: 1, maxLength: 2e4 }, mode: { type: "string", enum: ["followup", "steer"] }, clientRequestId: { type: "string" } }, ["sessionId", "text"], "chat"),
  l1("chat.follow", "\u8DDF\u968F\u56DE\u590D", "\u957F\u8F6E\u8BE2\u4F1A\u8BDD\u72B6\u6001\uFF08version \u6E38\u6807\uFF09\uFF0C\u6D41\u5F0F\u6587\u672C\u5728 live \u5B57\u6BB5", { sessionId: sid, version: { type: "integer" }, waitMs: { type: "integer", minimum: 0, maximum: 2e4 } }, ["sessionId"], "chat", true),
  l1("chat.cancel", "\u505C\u6B62\u56DE\u590D", "\u53D6\u6D88\u5F53\u524D\u56DE\u5408", { sessionId: sid }, ["sessionId"], "chat"),
  l1("chat.answerAsk", "\u56DE\u7B54\u63D0\u95EE", "\u56DE\u7B54 ask_user_question\uFF08\u9009\u9879/\u81EA\u5B9A\u4E49\u6587\u672C\uFF09", {
    sessionId: sid,
    callId: { type: "string", minLength: 1 },
    answers: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["id", "selected"],
        properties: {
          id: { type: "string" },
          selected: { type: "array", items: { type: "string" } },
          custom: { type: "string" }
        }
      }
    }
  }, ["sessionId", "callId", "answers"], "chat"),
  l1("models.list", "\u6A21\u578B\u76EE\u5F55", "\u53EF\u7528\u6A21\u578B\u4E0E\u5F53\u524D\u9009\u62E9", { sessionId: sid }, [], "config"),
  l1("models.select", "\u5207\u6362\u6A21\u578B", "\u4E3A\u4F1A\u8BDD\u9009\u62E9\u6A21\u578B", { sessionId: sid, provider: { type: "string" }, model: { type: "string" }, reasoningEffort: { type: "string" } }, ["sessionId", "provider", "model"], "config")
];
function listCapabilities(includeL1 = false) {
  const all = includeL1 ? [...L0_CATALOG, ...L1_CATALOG] : L0_CATALOG;
  return { agentCapVersion: AGENT_CAP_VERSION, capabilities: all.map((c) => ({ ...c })) };
}
function findCapability(id, includeL1 = false) {
  return L0_CATALOG.find((c) => c.id === id) || (includeL1 ? L1_CATALOG.find((c) => c.id === id) : void 0);
}

// src/bridge/chat.ts
import { randomUUID } from "node:crypto";
import { homedir as osHomedir } from "node:os";
import path from "node:path";
function fail(code, message) {
  const e = new Error(message);
  e.code = code;
  throw e;
}
function unwrap(v) {
  if (v && typeof v === "object" && typeof v.ok === "boolean" && ("value" in v || "error" in v)) {
    if (v.ok) return v.value;
    const err = v.error || {};
    fail(String(err.code || "DSH_ERROR"), String(err.message || "dsh error"));
  }
  return v;
}
function resolveSessionCwd(raw, home = osHomedir(), baseCwd = process.cwd()) {
  const s = String(raw ?? "").trim();
  if (!s) fail("VALIDATION", "cwd \u4E0D\u80FD\u4E3A\u7A7A");
  let expanded;
  if (s === "~") expanded = home;
  else if (s.startsWith("~/") || s.startsWith("~\\")) expanded = path.join(home, s.slice(2));
  else expanded = s;
  if (!path.isAbsolute(expanded)) expanded = path.resolve(baseCwd, expanded);
  const norm = path.normalize(expanded);
  return norm.length > 1 && (norm.endsWith("/") || norm.endsWith("\\")) ? norm.replace(/[\\/]+$/, "") : norm;
}
function textOf(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.filter((p) => p && (p.type === "text" || p.type === void 0) && typeof p.text === "string").map((p) => p.text).join("");
}
function basename(p) {
  const s = String(p || "").replace(/[\\/]+$/, "");
  const i = Math.max(s.lastIndexOf("/"), s.lastIndexOf("\\"));
  return i >= 0 ? s.slice(i + 1) : s;
}
var MAX_MESSAGES = 80;
function parseAskArguments(callId, raw) {
  let args = raw;
  if (typeof args === "string") {
    try {
      args = JSON.parse(args);
    } catch {
      return void 0;
    }
  }
  if (!args || typeof args !== "object") return void 0;
  const list = Array.isArray(args.questions) ? args.questions : null;
  if (!list || list.length === 0) return void 0;
  const questions = [];
  for (const q of list) {
    if (!q || typeof q !== "object") continue;
    const id = typeof q.id === "string" ? q.id : "";
    const question = typeof q.question === "string" ? q.question : "";
    if (!id || !question) continue;
    const options = Array.isArray(q.options) ? q.options.map((o) => ({
      label: String(o?.label ?? ""),
      ...typeof o?.description === "string" ? { description: o.description } : {}
    })).filter((o) => o.label) : void 0;
    questions.push({
      id,
      question,
      ...typeof q.header === "string" ? { header: q.header } : {},
      ...options && options.length ? { options } : {},
      ...q.multi_select === true || q.multiSelect === true ? { multiSelect: true } : {}
    });
  }
  if (!questions.length) return void 0;
  return { callId: callId || "unknown", questions };
}
function isPendingAskResult(d) {
  const candidates = [d?.result, d?.value, d?.message?.result, d?.message?.content, d?.content, d];
  for (const raw of candidates) {
    let v = raw;
    if (typeof v === "string") {
      try {
        v = JSON.parse(v);
      } catch {
        continue;
      }
    }
    if (v && typeof v === "object" && !Array.isArray(v) && v.pending === true) return true;
    if (Array.isArray(v)) {
      for (const p of v) {
        if (p && p.type === "text" && typeof p.text === "string") {
          try {
            const j = JSON.parse(p.text);
            if (j && j.pending === true) return true;
          } catch {
          }
        }
      }
    }
  }
  return false;
}
function extractAskCallId(request) {
  const w = request?.wait;
  if (w && typeof w.callId === "string" && w.callId.trim()) return w.callId.trim();
  if (typeof request?.callId === "string" && request.callId.trim()) return request.callId.trim();
  if (typeof request?.toolCallId === "string" && request.toolCallId.trim()) return request.toolCallId.trim();
  const qs = Array.isArray(request?.questions) ? request.questions : [];
  for (const q of qs) {
    const id = q?.intent?.callId;
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  return "";
}
function extractAskSessionId(request) {
  const a = request?.agent;
  if (!a) return null;
  if (typeof a === "string" && a.trim()) return a.trim();
  if (typeof a.id === "string" && a.id.trim()) return a.id.trim();
  if (typeof a.sessionId === "string" && a.sessionId.trim()) return a.sessionId.trim();
  if (typeof a.address?.sessionId === "string" && a.address.sessionId.trim()) return a.address.sessionId.trim();
  return null;
}
function applyEvent(msgs, ev) {
  if (!ev || typeof ev.type !== "string") return false;
  if (ev.ignorable === true) return false;
  const d = ev.data ?? ev;
  const seq = Number(ev.seq) || 0;
  const time = typeof ev.time === "number" ? ev.time : void 0;
  switch (ev.type) {
    case "user/message": {
      if (d?.source?.kind !== "user") return false;
      const t = textOf(d.content ?? d.message?.content);
      if (!t.trim()) return false;
      msgs.push({ seq, role: "user", text: t, time });
      return true;
    }
    case "assistant/message": {
      const t = textOf(d.message?.content ?? d.content);
      if (t.trim()) msgs.push({ seq, role: "assistant", text: t, time });
      return true;
    }
    case "system/message":
    case "developer/message":
      return false;
    case "tool/call": {
      const name2 = String(d.name || "tool");
      const callId = typeof d.callId === "string" ? d.callId : void 0;
      const ask = name2 === "ask_user_question" || name2 === "request_user_input" ? parseAskArguments(callId || `seq-${seq}`, d.arguments ?? d.input ?? d.params) : void 0;
      msgs.push({
        seq,
        role: "step",
        text: ask ? ask.questions[0]?.header || ask.questions[0]?.question || name2 : name2,
        name: name2,
        status: "running",
        callId,
        time,
        ...ask ? { ask } : {}
      });
      return true;
    }
    case "tool/result": {
      const callId = d.message?.callId ?? d.message?.toolCallId ?? d.callId;
      const pending = isPendingAskResult(d);
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        if (m.role === "step" && m.status === "running" && (callId === void 0 || m.callId === callId)) {
          if (pending && m.ask) m.status = "running";
          else m.status = d.error ? "error" : "done";
          break;
        }
      }
      return true;
    }
    default:
      return false;
  }
}
function chunkText(frame) {
  const c = frame && frame.chunk;
  if (!c) return "";
  if (c.type === "text-delta" && typeof c.text === "string") return c.text;
  return "";
}
var Follower = class {
  constructor(ctl, sessionId, onClose, bridge) {
    this.ctl = ctl;
    this.onClose = onClose;
    this.bridge = bridge;
    this.state = { sessionId, version: 0, cursor: -1, messages: [], live: "", running: false, error: null, pendingAsk: null };
    void this.run();
  }
  state;
  abort = new AbortController();
  waiters = [];
  lastPoll = Date.now();
  closed = false;
  bump() {
    this.state.version++;
    if (this.state.messages.length > MAX_MESSAGES) this.state.messages.splice(0, this.state.messages.length - MAX_MESSAGES);
    const w = this.waiters;
    this.waiters = [];
    for (const f of w) f();
  }
  wait(ms) {
    return new Promise((r) => {
      const t = setTimeout(() => {
        this.waiters = this.waiters.filter((x) => x !== done);
        r();
      }, ms);
      const done = () => {
        clearTimeout(t);
        r();
      };
      this.waiters.push(done);
    });
  }
  markRunning(v) {
    this.state.running = v;
    this.bump();
  }
  async run() {
    try {
      const it = this.ctl.follow(
        { address: { kind: "session", sessionId: this.state.sessionId }, maxMessages: 60, assistantStream: true },
        this.abort.signal
      );
      for await (const raw of it) {
        const f = unwrap(raw);
        if (!f) continue;
        if (f.type === "snapshot") {
          this.state.messages = [];
          for (const r of f.records || []) if (r && r.type === "event") applyEvent(this.state.messages, r.event);
          this.state.cursor = Number(f.cursor) || 0;
          const active2 = f.assistantStream && f.assistantStream.activeAttempt;
          this.state.live = active2 ? active2.stream?.text ?? "" : "";
          this.state.running = Boolean(active2);
          this.bridge.onFollowerAskEvents(this, "snapshot");
          this.bump();
        } else if (f.type === "event") {
          const ev = f.event;
          applyEvent(this.state.messages, ev);
          this.state.cursor = Number(ev?.seq) || this.state.cursor;
          if (ev?.type === "assistant/message") this.state.live = "";
          if (ev?.type === "turn/start") this.state.running = true;
          if (ev?.type === "turn/end" || ev?.type === "agent/idle") {
            this.state.running = false;
            this.state.live = "";
          }
          if (ev?.type === "tool/call" || ev?.type === "tool/result") {
            this.bridge.onFollowerAskEvents(this, ev?.type === "tool/call" ? "tool/call" : "tool/result");
          } else {
            this.bridge.refreshFollowerPendingAsk(this);
          }
          this.bump();
        } else if (f.type === "assistant-stream") {
          const fr = f.frame || {};
          if (fr.type === "start") {
            this.state.live = "";
            this.state.running = true;
          }
          const t = chunkText(fr);
          if (t) this.state.live += t;
          this.bump();
        }
      }
    } catch (e) {
      if (!this.abort.signal.aborted) {
        this.state.error = e?.message ? String(e.message) : "follow failed";
        this.bump();
      }
    } finally {
      this.closed = true;
      this.onClose();
    }
  }
  setPendingAsk(ask) {
    const prev = this.state.pendingAsk?.callId;
    const next = ask?.callId;
    if (prev === next && ask == null === (this.state.pendingAsk == null)) return;
    this.state.pendingAsk = ask;
    this.bump();
  }
  clearPendingAsk(callId) {
    if (!this.state.pendingAsk) return;
    if (callId && this.state.pendingAsk.callId !== callId) return;
    this.state.pendingAsk = null;
    this.bump();
  }
  /** Latest running ask step in the transcript, if any. */
  askFromMessages() {
    for (let i = this.state.messages.length - 1; i >= 0; i--) {
      const m = this.state.messages[i];
      if (m.role === "step" && m.status === "running" && m.ask) return m.ask;
    }
    return void 0;
  }
  close() {
    this.abort.abort();
    this.closed = true;
    this.bump();
  }
};
var ChatBridge = class {
  constructor(controller, idleMs = 12e4) {
    this.controller = controller;
    this.idleMs = idleMs;
  }
  followers = /* @__PURE__ */ new Map();
  sweeper = null;
  available() {
    const c = this.controller();
    return Boolean(c && typeof c.list === "function" && typeof c.prompt === "function" && typeof c.modelCatalog === "function");
  }
  ctl() {
    const c = this.controller();
    if (!c) fail("UNAVAILABLE", "DSH sessionController \u4E0D\u53EF\u7528\uFF08\u9700 DSH Desktop 0.2.x\uFF09");
    return c;
  }
  sig(ms = 3e4) {
    return AbortSignal.timeout(ms);
  }
  async sessionsList() {
    const r = unwrap(await this.ctl().list({}, this.sig()));
    const items = (r && Array.isArray(r.items) ? r.items : []).filter((it) => !it.parentSessionId);
    const sessions = items.map((it) => {
      const v = it.projections?.values || {};
      const title = typeof v.title === "string" ? v.title : typeof v.sessionTitle?.title === "string" ? v.sessionTitle.title : null;
      return {
        sessionId: it.sessionId,
        title,
        cwd: it.cwd ?? null,
        space: it.cwd ? basename(it.cwd) : null,
        updatedAt: it.updatedAt ?? null,
        running: Boolean(it.running),
        blank: Boolean(it.blank)
      };
    });
    const spaces = {};
    for (const s of sessions) if (s.cwd) (spaces[s.cwd] ??= { name: s.space, cwd: s.cwd, count: 0 }).count++;
    return { sessions, spaces: Object.values(spaces) };
  }
  async sessionCreate(params) {
    const req = {};
    const workspaceId = typeof params.workspaceId === "string" ? params.workspaceId.trim() : "";
    const hasCwd = typeof params.cwd === "string";
    const cwdRaw = hasCwd ? params.cwd : "";
    if (workspaceId && hasCwd && cwdRaw.trim()) fail("VALIDATION", "workspaceId \u4E0E cwd \u4E0D\u80FD\u540C\u65F6\u6307\u5B9A");
    if (workspaceId) {
      req.workspaceId = workspaceId;
    } else if (hasCwd) {
      if (!cwdRaw.trim()) fail("VALIDATION", "cwd \u4E0D\u80FD\u4E3A\u7A7A");
      req.cwd = resolveSessionCwd(cwdRaw);
    }
    const r = unwrap(await this.ctl().create(req));
    const sessionId = r?.sessionId ?? r?.session?.id ?? r?.id;
    if (!sessionId) fail("DSH_ERROR", "create \u672A\u8FD4\u56DE sessionId");
    let cwd = req.cwd ?? null;
    try {
      const list = unwrap(await this.ctl().list({}, this.sig(1e4)));
      const item = (list?.items || []).find((it) => it.sessionId === sessionId);
      if (item && typeof item.cwd === "string" && item.cwd) cwd = item.cwd;
    } catch {
    }
    return { sessionId, cwd, agentPreset: r?.agentPreset ?? null };
  }
  async sessionRename(params) {
    const sessionId = reqSession(params);
    const title = typeof params.title === "string" ? params.title.trim() : "";
    if (!title) fail("BAD_REQUEST", "title \u4E0D\u80FD\u4E3A\u7A7A");
    unwrap(await this.ctl().rename({ sessionId, title }));
    return { sessionId, title };
  }
  async sessionDelete(params) {
    const sessionId = reqSession(params);
    this.followers.get(sessionId)?.close();
    this.followers.delete(sessionId);
    unwrap(await this.ctl().delete({ sessionId }));
    return { sessionId, deleted: true };
  }
  async history(params) {
    const sessionId = reqSession(params);
    const max = Math.min(Math.max(Number(params.maxMessages) || 50, 1), 200);
    const req = { address: { kind: "session", sessionId }, maxMessages: max };
    if (Number.isSafeInteger(params.beforeSeq)) req.beforeSeq = params.beforeSeq;
    const r = unwrap(await this.ctl().page(req, this.sig()));
    const messages = [];
    for (const rec of r?.records || []) if (rec && rec.type === "event") applyEvent(messages, rec.event);
    return { sessionId, messages, hasMore: Boolean(r?.hasMore) };
  }
  follower(sessionId) {
    let f = this.followers.get(sessionId);
    if (!f || f.closed) {
      f = new Follower(this.ctl(), sessionId, () => {
        if (this.followers.get(sessionId) === f) this.followers.delete(sessionId);
      }, this);
      this.followers.set(sessionId, f);
      this.ensureSweeper();
      this.refreshFollowerPendingAsk(f);
    }
    f.lastPoll = Date.now();
    return f;
  }
  ensureSweeper() {
    if (this.sweeper) return;
    this.sweeper = setInterval(() => {
      const now = Date.now();
      for (const [id, f] of this.followers) if (now - f.lastPoll > this.idleMs) {
        f.close();
        this.followers.delete(id);
      }
      if (this.followers.size === 0 && this.sweeper) {
        clearInterval(this.sweeper);
        this.sweeper = null;
      }
    }, 15e3);
    this.sweeper.unref?.();
  }
  async prompt(params) {
    const sessionId = reqSession(params);
    const text2 = typeof params.text === "string" ? params.text : "";
    if (!text2.trim()) fail("VALIDATION", "text required");
    if (text2.length > 2e4) fail("VALIDATION", "text too long");
    const f = this.follower(sessionId);
    const requestId = typeof params.clientRequestId === "string" && params.clientRequestId ? params.clientRequestId : randomUUID();
    const req = { requestId, sessionId, mode: params.mode === "steer" ? "steer" : "followup", content: [{ type: "text", text: text2 }] };
    const r = unwrap(await this.ctl().prompt(req, this.sig()));
    f.markRunning(true);
    return { accepted: r?.accepted !== false, requestId, version: f.state.version };
  }
  /** Long-poll: returns immediately if version differs, else waits up to waitMs for a change. */
  async follow(params) {
    const sessionId = reqSession(params);
    const since = Number.isSafeInteger(params.version) ? Number(params.version) : -1;
    const waitMs = Math.min(Math.max(Number(params.waitMs) || 0, 0), 2e4);
    const f = this.follower(sessionId);
    if (f.state.version === since && waitMs > 0) await f.wait(waitMs);
    if (f.state.version === since) return { ...f.state, messages: [], unchanged: true };
    return { ...f.state, messages: f.state.messages.map((m) => ({ ...m })) };
  }
  async cancel(params) {
    const sessionId = reqSession(params);
    unwrap(await this.ctl().cancel({ sessionId }));
    return { cancelled: true };
  }
  async modelsList(params) {
    const cat = unwrap(await this.ctl().modelCatalog());
    let current = cat?.default ?? null;
    const sessionId = typeof params.sessionId === "string" ? params.sessionId : "";
    if (sessionId && typeof this.ctl().projections === "function") {
      try {
        const p = unwrap(await this.ctl().projections({ sessionId }, this.sig(1e4)));
        const ms = p?.values?.modelSelection;
        const sel = ms?.next ?? ms?.pending ?? ms?.lastUsed;
        if (sel && sel.provider && sel.model) current = sel;
      } catch {
      }
    }
    const groups = (cat?.groups || []).map((g) => ({
      id: g.id,
      name: g.name ?? g.id,
      models: (g.models || []).map((m) => ({
        id: m.id,
        name: m.name ?? m.displayName ?? m.id,
        reasoning: m.reasoning ? { efforts: (m.reasoning.efforts || []).map((e) => e.id ?? e), defaultEffort: m.reasoning.defaultEffort ?? null } : null
      }))
    }));
    return { current, default: cat?.default ?? null, groups, failures: cat?.failures ?? [] };
  }
  async modelsSelect(params) {
    const sessionId = reqSession(params);
    const provider = typeof params.provider === "string" ? params.provider : "";
    const model = typeof params.model === "string" ? params.model : "";
    if (!provider || !model) fail("VALIDATION", "provider and model required");
    const req = { sessionId, provider, model };
    if (typeof params.reasoningEffort === "string" && params.reasoningEffort) req.reasoningEffort = params.reasoningEffort;
    const r = unwrap(await this.ctl().selectModel(req));
    return { selection: r ?? { provider, model } };
  }
  parks = /* @__PURE__ */ new Map();
  /** Park ask for this session (or all followers if session unknown). */
  surfaceAsk(ask, sessionId) {
    if (sessionId) {
      const f = this.followers.get(sessionId);
      if (f && !f.closed) f.setPendingAsk(ask);
      return;
    }
    for (const f of this.followers.values()) {
      if (!f.closed) f.setPendingAsk(ask);
    }
  }
  parkAskForSession(sessionId) {
    if (sessionId) {
      for (const p of this.parks.values()) {
        if (p.sessionId === sessionId) return p;
      }
    }
    if (this.parks.size === 1) return this.parks.values().next().value;
    return void 0;
  }
  /** Keep pendingAsk while a waterfall park is live; rebind provisional parks to tool callId. */
  onFollowerAskEvents(f, kind) {
    if (kind === "tool/call" || kind === "snapshot") {
      const fromMsg = f.askFromMessages();
      if (fromMsg?.callId) this.rebindParkToCallId(f.state.sessionId, fromMsg);
    }
    this.refreshFollowerPendingAsk(f);
  }
  refreshFollowerPendingAsk(f) {
    const fromMsg = f.askFromMessages();
    const park = this.parkAskForSession(f.state.sessionId);
    let next = null;
    if (fromMsg) next = fromMsg;
    else if (park) next = park.ask;
    if (!next && f.state.pendingAsk) {
      const still = [...this.parks.values()].some((p) => p.callId === f.state.pendingAsk.callId || p.key === f.state.pendingAsk.callId);
      if (still) return;
    }
    f.setPendingAsk(next);
  }
  /** Legacy ask() has no wait.callId — re-key the provisional park when tool/call arrives. */
  rebindParkToCallId(sessionId, ask) {
    const toolCallId = ask.callId;
    if (!toolCallId || toolCallId.startsWith("prov-") || toolCallId.startsWith("seq-")) return;
    if (this.parks.has(toolCallId)) {
      const existing = this.parks.get(toolCallId);
      existing.ask = ask;
      existing.provisional = false;
      if (!existing.sessionId) existing.sessionId = sessionId;
      this.surfaceAsk(ask, sessionId);
      return;
    }
    let target = null;
    for (const [key, p2] of this.parks) {
      if (!p2.provisional) continue;
      if (p2.sessionId && p2.sessionId !== sessionId) continue;
      target = key;
      break;
    }
    if (!target && this.parks.size === 1) {
      const only = this.parks.keys().next().value;
      const p2 = this.parks.get(only);
      if (p2.provisional || !p2.sessionId || p2.sessionId === sessionId) target = only;
    }
    if (!target) return;
    const p = this.parks.get(target);
    this.parks.delete(target);
    p.key = toolCallId;
    p.callId = toolCallId;
    p.provisional = false;
    p.sessionId = p.sessionId || sessionId;
    p.ask = ask;
    p.questions = ask.questions;
    this.parks.set(toolCallId, p);
    this.surfaceAsk(ask, p.sessionId);
  }
  /**
   * Host waterfall handler: race Desktop Web UI (next) with a remote park so the
   * phone can answer ask_user_question. First successful answer wins.
   */
  raceUserQuestion(request, next) {
    const knownCallId = extractAskCallId(request);
    const sessionId = extractAskSessionId(request);
    const questions = Array.isArray(request?.questions) ? request.questions : [];
    const parkKey = knownCallId || `prov-${randomUUID()}`;
    const park = this.parkAsk(parkKey, questions, request?.signal, {
      sessionId,
      provisional: !knownCallId,
      callId: knownCallId || parkKey
    });
    const entry = this.parks.get(parkKey);
    let desktop;
    try {
      desktop = Promise.resolve(next());
    } catch (e) {
      return park;
    }
    return new Promise((resolve, reject) => {
      let done = false;
      const win = (value, from) => {
        if (done) return;
        done = true;
        if (from === "desktop" && entry) this.dropParkEntry(entry);
        resolve(value);
      };
      park.then((v) => win(v, "remote"), (err) => {
        if (done) return;
        if (err && err.code === "SUPERSEDED") return;
        desktop.then((v) => win(v, "desktop"), reject);
      });
      desktop.then((v) => win(v, "desktop"), (_err) => {
        if (done) return;
        park.then((v) => win(v, "remote"), reject);
      });
    });
  }
  parkAsk(parkKey, questions, signal, meta) {
    this.dropPark(parkKey, meta.callId !== parkKey ? meta.callId : void 0);
    const ask = {
      callId: meta.callId,
      questions: questions.map((q) => ({
        id: String(q.id),
        question: String(q.question ?? ""),
        ...typeof q.header === "string" ? { header: q.header } : {},
        ...Array.isArray(q.options) ? {
          options: q.options.map((o) => ({
            label: String(o?.label ?? ""),
            ...typeof o?.description === "string" ? { description: o.description } : {}
          })).filter((o) => o.label)
        } : {},
        ...q.multiSelect === true || q.multi_select === true ? { multiSelect: true } : {}
      }))
    };
    this.surfaceAsk(ask, meta.sessionId);
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        signal?.removeEventListener?.("abort", onAbort);
        for (const [k, p] of this.parks) {
          if (p === entry) {
            this.parks.delete(k);
            break;
          }
        }
      };
      const onAbort = () => {
        cleanup();
        for (const f of this.followers.values()) f.clearPendingAsk(ask.callId);
        reject(Object.assign(new Error("ask aborted"), { code: "ABORTED" }));
      };
      if (signal?.aborted) {
        onAbort();
        return;
      }
      signal?.addEventListener?.("abort", onAbort);
      const entry = {
        key: parkKey,
        callId: meta.callId,
        provisional: meta.provisional,
        sessionId: meta.sessionId,
        ask,
        questions: ask.questions,
        resolve: (v) => {
          cleanup();
          for (const f of this.followers.values()) f.clearPendingAsk(entry.callId);
          resolve(v);
        },
        reject: (e) => {
          cleanup();
          for (const f of this.followers.values()) f.clearPendingAsk(entry.callId);
          reject(e);
        },
        cleanup
      };
      this.parks.set(parkKey, entry);
    });
  }
  dropParkEntry(entry) {
    let found = false;
    for (const [k, p] of this.parks) {
      if (p === entry || p.callId === entry.callId) {
        found = true;
        try {
          p.reject(Object.assign(new Error("superseded"), { code: "SUPERSEDED" }));
        } catch {
        }
        p.cleanup();
        this.parks.delete(k);
        for (const f of this.followers.values()) f.clearPendingAsk(p.callId);
      }
    }
    if (!found) {
      try {
        entry.reject(Object.assign(new Error("superseded"), { code: "SUPERSEDED" }));
      } catch {
      }
      try {
        entry.cleanup();
      } catch {
      }
      for (const f of this.followers.values()) f.clearPendingAsk(entry.callId);
    }
  }
  dropPark(...keys) {
    for (const callId of keys) {
      if (!callId) continue;
      for (const [k, park] of [...this.parks]) {
        if (k === callId || park.callId === callId || park.key === callId) {
          this.dropParkEntry(park);
        }
      }
    }
  }
  /** App submits answers for a parked ask_user_question. */
  async answerAsk(params) {
    const callId = typeof params.callId === "string" ? params.callId : "";
    if (!callId) fail("VALIDATION", "callId required");
    const raw = params.answers;
    if (!Array.isArray(raw) || raw.length === 0) fail("VALIDATION", "answers required");
    const answers = [];
    for (const a of raw) {
      if (!a || typeof a !== "object") continue;
      const id = typeof a.id === "string" ? a.id : "";
      const selected = Array.isArray(a.selected) ? a.selected.filter((x) => typeof x === "string") : [];
      if (!id) continue;
      const item = { id, selected };
      if (typeof a.custom === "string" && a.custom.trim()) item.custom = String(a.custom);
      answers.push(item);
    }
    if (!answers.length) fail("VALIDATION", "answers required");
    const sessionId = typeof params.sessionId === "string" ? params.sessionId : "";
    let park = this.parks.get(callId);
    if (!park) {
      for (const p of this.parks.values()) {
        if (p.callId === callId || p.key === callId) {
          park = p;
          break;
        }
      }
    }
    if (!park) {
      const candidates = [...this.parks.values()].filter((p) => !sessionId || !p.sessionId || p.sessionId === sessionId);
      if (candidates.length === 1) park = candidates[0];
    }
    if (park) {
      park.resolve({ answers });
      return { ok: true, callId: park.callId, via: "waterfall" };
    }
    const uq = this.userQuestions?.();
    if (uq && typeof uq.answer === "function" && sessionId) {
      try {
        const agent = typeof uq.agentOf === "function" ? uq.agentOf(sessionId) : sessionId;
        unwrap(await uq.answer(agent, callId, { answers }));
        for (const f of this.followers.values()) f.clearPendingAsk(callId);
        return { ok: true, callId, via: "continued" };
      } catch (e) {
        fail(e?.code || "DSH_ERROR", e?.message || "userQuestions.answer failed");
      }
    }
    fail("NOT_FOUND", "\u6CA1\u6709\u7B49\u5F85\u4E2D\u7684\u63D0\u95EE\uFF08callId \u65E0\u6548\u6216\u5DF2\u7ED3\u675F\uFF09");
  }
  userQuestions = null;
  /** Optional: wire ctx.userQuestions for continued (timed) answers. */
  setUserQuestions(getter) {
    this.userQuestions = getter;
  }
  dispose() {
    for (const p of this.parks.values()) {
      try {
        p.reject(Object.assign(new Error("disposed"), { code: "ABORTED" }));
      } catch {
      }
    }
    this.parks.clear();
    for (const f of this.followers.values()) f.close();
    this.followers.clear();
    if (this.sweeper) {
      clearInterval(this.sweeper);
      this.sweeper = null;
    }
  }
};
function reqSession(params) {
  const s = params.sessionId;
  if (typeof s !== "string" || !s || s.length > 200) fail("VALIDATION", "sessionId required");
  return s;
}

// src/bridge/logs.ts
var LogRing = class {
  constructor(max = 500) {
    this.max = max;
  }
  buf = [];
  push(text2, source = "agent") {
    const entry = { ts: Date.now(), text: redact(text2), source: String(source || "agent") };
    this.buf.push(entry);
    if (this.buf.length > this.max) this.buf.splice(0, this.buf.length - this.max);
  }
  tail(n) {
    const lines = Math.min(500, Math.max(1, Number.isFinite(Number(n)) ? Math.floor(Number(n)) : 100));
    return this.buf.slice(-lines).map((e) => ({ ...e }));
  }
  clear() {
    this.buf = [];
  }
  get size() {
    return this.buf.length;
  }
};
function clampLogLines(params) {
  const raw = params && params.lines !== void 0 ? Number(params.lines) : 100;
  if (!Number.isFinite(raw)) return 100;
  return Math.min(500, Math.max(1, Math.floor(raw)));
}

// src/bridge/health.ts
import net from "node:net";
function isLoopbackHost(host) {
  const h = String(host || "").trim().toLowerCase();
  if (!h || h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "0.0.0.0" || h === "::") return true;
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  return false;
}
function normalizeProbeHost(host) {
  const h = String(host || "").trim();
  if (!h || h === "0.0.0.0" || h === "::") return "127.0.0.1";
  return h;
}
function probeTcp(host, port, timeoutMs = 1500) {
  const start = Date.now();
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok, error) => {
      if (settled) return;
      settled = true;
      try {
        sock.destroy();
      } catch {
      }
      resolve({ ok, latencyMs: ok ? Date.now() - start : null, error });
    };
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      resolve({ ok: false, latencyMs: null, error: "bad port" });
      return;
    }
    if (!isLoopbackHost(host)) {
      resolve({ ok: false, latencyMs: null, error: "host not in loopback whitelist" });
      return;
    }
    const target = normalizeProbeHost(host);
    const sock = net.connect({ host: target, port, family: 4 });
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => done(true, null));
    sock.once("timeout", () => done(false, "timeout"));
    sock.once("error", (e) => done(false, e && e.message ? e.message : "connect failed"));
  });
}
async function checkServicesHealth(opts) {
  const services = [];
  const local = opts.local;
  if (local && local.port) {
    if (!isLoopbackHost(local.host)) {
      services.push({
        id: "webServer",
        ok: false,
        host: local.host,
        port: local.port,
        latencyMs: null,
        error: "refused: webServer host is not loopback"
      });
    } else {
      const r = await probeTcp(local.host, local.port);
      services.push({
        id: "webServer",
        ok: r.ok,
        host: normalizeProbeHost(local.host),
        port: local.port,
        latencyMs: r.latencyMs,
        error: r.error
      });
    }
  } else {
    services.push({
      id: "webServer",
      ok: false,
      detail: "not ready",
      error: "webServer endpoint unknown"
    });
  }
  const st = opts.linkState != null ? String(opts.linkState) : null;
  if (st != null) {
    services.push({
      id: "hubLink",
      ok: st === "online",
      detail: st,
      error: st === "online" ? null : st
    });
  }
  return { checkedAt: Date.now(), services };
}

// src/bridge/ops.ts
var DEFAULT_OPS_POLICY = {
  remoteRestart: false,
  allowPluginReload: false,
  allowPluginUpdate: false
};
function normalizeOpsPolicy(raw) {
  const r = raw || {};
  return {
    remoteRestart: r.remoteRestart === true,
    allowPluginReload: r.allowPluginReload === true,
    allowPluginUpdate: r.allowPluginUpdate === true
  };
}
function wantExecute(params) {
  return params && (params.execute === true || params.dryRun === false);
}
function gateDshRestart(policy, params) {
  if (!policy.remoteRestart) {
    return {
      ok: false,
      code: "REMOTE_RESTART_DISABLED",
      message: "remoteRestart is disabled on this agent (set config.remoteRestart=true to allow dry-run/execute path)"
    };
  }
  if (!wantExecute(params)) {
    return {
      ok: true,
      data: {
        capability: "dsh.restart",
        dryRun: true,
        allowed: true,
        executed: false,
        message: "dry-run only; pass execute:true to request restart (still stubbed in A0.4)"
      }
    };
  }
  return {
    ok: false,
    code: "STUB",
    message: "dsh.restart execute is stubbed; real restart not wired yet (A0.4 skeleton)"
  };
}
function gatePluginReload(policy, params) {
  if (!policy.allowPluginReload) {
    return {
      ok: false,
      code: "RELOAD_DISABLED",
      message: "plugin.reload disabled (config.allowPluginReload=true to enable gate)"
    };
  }
  if (!wantExecute(params)) {
    return {
      ok: true,
      data: {
        capability: "plugin.reload",
        dryRun: true,
        allowed: true,
        executed: false,
        message: "dry-run only; Cordis hot-reload not wired"
      }
    };
  }
  return {
    ok: false,
    code: "STUB",
    message: "plugin.reload execute is stubbed; hot-reload not wired yet"
  };
}
function gatePluginUpdate(policy, params) {
  if (!policy.allowPluginUpdate) {
    return {
      ok: false,
      code: "UPDATE_DISABLED",
      message: "plugin.update disabled (config.allowPluginUpdate=true to enable gate)"
    };
  }
  if (!wantExecute(params)) {
    return {
      ok: true,
      data: {
        capability: "plugin.update",
        dryRun: true,
        allowed: true,
        executed: false,
        message: "dry-run only; signed update path not wired"
      }
    };
  }
  return {
    ok: false,
    code: "STUB",
    message: "plugin.update execute is stubbed; signed self-update not wired yet"
  };
}

// src/bridge/router.ts
var active = /* @__PURE__ */ new Map();
function fail2(code, message) {
  const e = new Error(message);
  e.code = code;
  throw e;
}
var BridgeRouter = class {
  constructor(deps) {
    this.deps = deps;
  }
  list() {
    return listCapabilities(this.l1());
  }
  l1() {
    try {
      return Boolean(this.deps.chat && this.deps.chat.available());
    } catch {
      return false;
    }
  }
  cancel(requestId) {
    const a = active.get(requestId);
    if (!a) return false;
    a.cancelled = true;
    return true;
  }
  async invoke(capability, params, requestId) {
    if (!requestId || typeof requestId !== "string") {
      return { ok: false, requestId: String(requestId || ""), code: "VALIDATION", message: "requestId required" };
    }
    const desc = findCapability(capability, this.l1());
    if (!desc) {
      return { ok: false, requestId, code: "NOT_FOUND", message: `unknown capability: ${capability}` };
    }
    const slot = { cancelled: false };
    active.set(requestId, slot);
    try {
      const data = await this.dispatch(desc.id, params || {}, requestId, slot);
      if (slot.cancelled) {
        return { ok: false, requestId, code: "CANCELLED", message: "cancelled" };
      }
      return { ok: true, requestId, data };
    } catch (e) {
      const code = e && e.code ? String(e.code) : "INTERNAL";
      const message = e && e.message ? String(e.message) : "invoke failed";
      return { ok: false, requestId, code, message };
    } finally {
      active.delete(requestId);
    }
  }
  async dispatch(id, params, _requestId, _slot) {
    switch (id) {
      case "instance.status":
        return this.facadeStatus();
      case "instance.metrics":
        return this.facadeMetrics();
      case "instance.enrollment":
        return this.facadeEnrollment();
      case "instance.logs.tail":
        return this.facadeLogsTail(params);
      case "services.health":
        return this.facadeHealth();
      case "dsh.restart":
        return this.facadeOps("dsh.restart", params);
      case "plugin.reload":
        return this.facadeOps("plugin.reload", params);
      case "plugin.update":
        return this.facadeOps("plugin.update", params);
      case "chat.sessions.list":
        return this.deps.chat.sessionsList();
      case "chat.session.create":
        return this.deps.chat.sessionCreate(params);
      case "chat.session.rename":
        return this.deps.chat.sessionRename(params);
      case "chat.session.delete":
        return this.deps.chat.sessionDelete(params);
      case "chat.history":
        return this.deps.chat.history(params);
      case "chat.prompt":
        return this.deps.chat.prompt(params);
      case "chat.follow":
        return this.deps.chat.follow(params);
      case "chat.cancel":
        return this.deps.chat.cancel(params);
      case "chat.answerAsk":
        return this.deps.chat.answerAsk(params);
      case "models.list":
        return this.deps.chat.modelsList(params);
      case "models.select":
        return this.deps.chat.modelsSelect(params);
      default:
        fail2("NOT_FOUND", `unknown capability: ${id}`);
    }
  }
  facadeStatus() {
    const s = this.deps.status() || {};
    return {
      dshReady: Boolean(s.dshReady),
      restartNeeded: Boolean(s.restartNeeded),
      plugin: s.plugin ?? null,
      platform: s.platform ?? null,
      arch: s.arch ?? null,
      uptime: s.uptime ?? null,
      rss: s.rss ?? null,
      cpu: s.cpu ?? null,
      memUsed: s.memUsed ?? null,
      load: s.load ?? null,
      rtt: s.rtt ?? null,
      streams: s.streams ?? null
    };
  }
  facadeMetrics() {
    const s = (this.deps.metrics ? this.deps.metrics() : this.deps.status()) || {};
    return {
      cpu: s.cpu ?? null,
      memUsed: s.memUsed ?? null,
      load: s.load ?? null,
      uptime: s.uptime ?? null,
      rss: s.rss ?? null,
      platform: s.platform ?? null,
      arch: s.arch ?? null,
      rtt: s.rtt ?? null
    };
  }
  facadeEnrollment() {
    return this.deps.enrollment() || {};
  }
  facadeLogsTail(params) {
    const lines = clampLogLines(params);
    if (!this.deps.logs || typeof this.deps.logs.tail !== "function") {
      return { lines, entries: [], source: "none", note: "log ring not attached" };
    }
    const entries = this.deps.logs.tail(lines);
    return { lines: entries.length, requested: lines, entries, source: "ring" };
  }
  async facadeHealth() {
    try {
      const local = this.deps.local ? this.deps.local() : null;
      const linkState = this.deps.linkState ? this.deps.linkState() : null;
      const report = await checkServicesHealth({ local, linkState });
      return report;
    } catch (e) {
      return {
        checkedAt: Date.now(),
        services: [],
        error: e && e.message ? String(e.message) : "health failed"
      };
    }
  }
  facadeOps(which, params) {
    const policy = normalizeOpsPolicy(this.deps.opsPolicy ? this.deps.opsPolicy() : DEFAULT_OPS_POLICY);
    const gate = which === "dsh.restart" ? gateDshRestart(policy, params) : which === "plugin.reload" ? gatePluginReload(policy, params) : gatePluginUpdate(policy, params);
    if (!gate.ok) fail2(gate.code, gate.message);
    return gate.data;
  }
};
async function handleControlMessage(router, msg) {
  if (!msg || typeof msg !== "object") return null;
  if (msg.type === "capability.list") {
    const list = router.list();
    return { agentCapVersion: list.agentCapVersion, capabilities: list.capabilities };
  }
  if (msg.type === "capability.invoke") {
    const capability = String(msg.capability || msg.cap || "");
    const requestId = String(msg.requestId || "");
    const params = msg.params && typeof msg.params === "object" ? msg.params : {};
    const result = await router.invoke(capability, params, requestId);
    return result;
  }
  if (msg.type === "capability.cancel") {
    const requestId = String(msg.requestId || "");
    const ok = router.cancel(requestId);
    return { cancelled: ok, requestId };
  }
  return null;
}

// src/link.ts
var PROTO_TAG = "dra-v1";
var HubLink = class extends EventEmitter2 {
  constructor(o) {
    super();
    this.o = o;
  }
  state = "idle";
  lastError = null;
  since = null;
  rtt = null;
  hosts = [];
  ws = null;
  mux = null;
  ctrl = null;
  wanted = false;
  attempt = 0;
  timer = null;
  ticks = [];
  set(s, err) {
    this.state = s;
    if (err !== void 0) this.lastError = err;
    this.emit("change", s);
  }
  start() {
    if (this.wanted) return;
    this.wanted = true;
    let last = Date.now();
    const wake = setInterval(() => {
      const now = Date.now();
      if (now - last > 3e4 && this.wanted) {
        this.o.log.info("\u68C0\u6D4B\u5230\u4F11\u7720\u5524\u9192\uFF0C\u7ACB\u5373\u91CD\u8FDE");
        this.reconnectNow();
      }
      last = now;
    }, 5e3);
    wake.unref?.();
    this.ticks.push(wake);
    this.connect();
  }
  stop() {
    this.wanted = false;
    if (this.timer) clearTimeout(this.timer);
    for (const t of this.ticks) clearInterval(t);
    this.ticks = [];
    this.teardown();
    this.set("stopped");
  }
  /** Reconnect only if not already online or mid-dial (used by the manual "connect" button). */
  ensureConnected() {
    if (this.state !== "online" && this.state !== "connecting") this.reconnectNow();
  }
  reconnectNow() {
    this.attempt = 0;
    if (this.timer) clearTimeout(this.timer);
    this.teardown();
    this.connect();
  }
  teardown() {
    try {
      this.mux?.close();
    } catch {
    }
    try {
      this.ws?.terminate();
    } catch {
    }
    this.ws = null;
    this.mux = null;
    this.ctrl = null;
  }
  schedule(ms) {
    if (!this.wanted) return;
    const min = this.o.minBackoffMs ?? 1e3, max = this.o.maxBackoffMs ?? 6e4;
    const base = ms ?? Math.min(max, min * 2 ** Math.min(this.attempt, 10));
    const d = Math.round(base * (0.8 + Math.random() * 0.4));
    this.attempt++;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.connect(), d);
    this.timer.unref?.();
  }
  gen = 0;
  async connect() {
    if (!this.wanted) return;
    const gen = ++this.gen;
    this.teardown();
    this.set("connecting");
    const u = new URL("/agent/connect", this.o.hub);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    let proxy = null;
    try {
      proxy = await resolveProxy(this.o.proxy, this.o.hub);
    } catch {
    }
    if (gen !== this.gen || !this.wanted) return;
    const ws = new wrapper_default(u, { agent: agentFor(proxy), handshakeTimeout: 15e3, perMessageDeflate: false, maxPayload: 8 * 1024 * 1024 });
    this.ws = ws;
    const mux = new MuxSession({ send: (b) => {
      if (ws.readyState === wrapper_default.OPEN) ws.send(b);
    }, close: () => {
      try {
        ws.close();
      } catch {
      }
    } });
    this.mux = mux;
    let settled = false;
    const fail3 = (why) => {
      if (this.ws !== ws) {
        try {
          mux.close();
        } catch {
        }
        try {
          ws.terminate();
        } catch {
        }
        return;
      }
      this.teardown();
      if (this.state === "revoked") return;
      if (!settled) this.lastError = redact(why);
      settled = true;
      this.since = null;
      this.set(this.state === "pending" ? "pending" : "waiting", this.lastError);
      this.schedule(this.state === "pending" ? 1e4 : void 0);
    };
    ws.on("message", (d, isBinary) => {
      if (isBinary) mux.feed(Buffer.isBuffer(d) ? d : Buffer.from(d));
    });
    ws.on("error", (e) => fail3("\u8FDE\u63A5\u9519\u8BEF: " + e.message));
    ws.on("close", () => fail3("\u8FDE\u63A5\u5DF2\u65AD\u5F00"));
    ws.on("unexpected-response", (_req, res) => fail3(`Hub \u8FD4\u56DE HTTP ${res.statusCode}`));
    mux.on("close", (e) => fail3(e ? e.message : "\u4F1A\u8BDD\u5173\u95ED"));
    mux.on("stream", (s) => this.onStream(s));
    ws.on("open", () => this.handshake(mux).catch((e) => fail3(String(e.message || e))));
  }
  async handshake(mux) {
    const ctrl = mux.open();
    this.ctrl = ctrl;
    const lines = lineReader(ctrl);
    send(ctrl, { type: "hello", deviceId: this.o.deviceId, versions: this.o.versions });
    const ch = await lines.next(15e3);
    if (this.mux !== mux) throw new Error("superseded");
    if (ch.type !== "challenge") throw new Error("unexpected handshake");
    const msg = `${ch.nonce}|${ch.ts}|${this.o.deviceId}|${PROTO_TAG}`;
    send(ctrl, { type: "auth", sig: signMsg(this.o.key, msg) });
    const w = await lines.next(15e3);
    if (this.mux !== mux) throw new Error("superseded");
    if (w.type === "denied") {
      if (w.reason === "pending") {
        this.set("pending", "\u7B49\u5F85\u5728\u63A7\u5236\u53F0\u6838\u5BF9\u6307\u7EB9\u5E76\u6FC0\u6D3B");
        throw new Error("\u7B49\u5F85\u6FC0\u6D3B");
      }
      if (w.reason === "revoked" || /unknown device/.test(String(w.reason))) {
        this.set("revoked", "\u8BBE\u5907\u5DF2\u5728 Hub \u79FB\u9664");
        this.emit("revoked");
        this.wanted = false;
        throw new Error("revoked");
      }
      throw new Error("Hub \u62D2\u7EDD\u8FDE\u63A5: " + w.reason);
    }
    if (w.type !== "welcome") throw new Error("unexpected handshake");
    this.attempt = 0;
    this.hosts = Array.isArray(w.hosts) ? w.hosts : [];
    this.since = Date.now();
    this.set("online", null);
    this.emit("welcome", w);
    this.o.log.info("\u5DF2\u8FDE\u63A5 Hub");
    const pushStatus = () => send(ctrl, { type: "status", ...this.o.status(), streams: mux.streamCount, rtt: this.rtt });
    pushStatus();
    const st = setInterval(pushStatus, this.o.statusEveryMs ?? 3e4);
    st.unref?.();
    const pg = setInterval(() => {
      mux.ping(45e3).then((r) => {
        this.rtt = r;
      }).catch(() => {
        this.o.log.warn("\u5FC3\u8DF3\u8D85\u65F6\uFF0C\u91CD\u8FDE");
        mux.close(new Error("ping timeout"));
      });
    }, 2e4);
    pg.unref?.();
    mux.once("close", () => {
      clearInterval(st);
      clearInterval(pg);
    });
    (async () => {
      for (; ; ) {
        let m;
        try {
          m = await lines.next(0);
        } catch {
          return;
        }
        if (m.type === "revoked") {
          this.set("revoked", "\u8BBE\u5907\u5DF2\u5728 Hub \u79FB\u9664");
          this.wanted = false;
          this.emit("revoked");
          mux.close();
          return;
        }
        if (m.type === "sso.request") {
          this.o.sso(String(m.base)).then((setCookie) => send(ctrl, { type: "reply", id: m.id, setCookie }), (e) => send(ctrl, { type: "reply", id: m.id, error: "sso failed" + (e && e.code ? ": " + e.code : "") }));
          continue;
        }
        if (this.o.bridge && m.type && String(m.type).startsWith("capability.")) {
          const id = m.id;
          handleControlMessage(this.o.bridge, m).then((body) => {
            if (!id) return;
            if (!body) {
              send(ctrl, { type: "reply", id, error: "unsupported" });
              return;
            }
            send(ctrl, { type: "reply", id, ...body });
          }, (e) => {
            if (id) send(ctrl, { type: "reply", id, error: String(e && e.message || e), code: "INTERNAL" });
          });
          continue;
        }
        if (m.id) send(ctrl, { type: "reply", id: m.id, error: "unsupported" });
      }
    })();
  }
  onStream(s) {
    const lines = lineReader(s, true);
    lines.next(1e4).then((pre) => {
      const target = pre && pre.svc === "dsh" ? this.o.local() : null;
      if (!target) {
        s.destroy();
        return;
      }
      const rest = lines.rest();
      const sock = net2.connect({ host: target.host, port: target.port, allowHalfOpen: true });
      sock.setNoDelay(true);
      if (rest.length) sock.write(rest);
      s.pipe(sock);
      sock.pipe(s);
      const kill = () => {
        s.destroy();
        sock.destroy();
      };
      sock.on("error", kill);
      s.on("error", kill);
      sock.on("close", () => {
        if (!s.destroyed) s.end();
      });
    }, () => s.destroy());
  }
};
function send(s, m) {
  s.write(JSON.stringify(m) + "\n");
}
function lineReader(s, once = false) {
  let buf = Buffer.alloc(0);
  const queue = [];
  const waiters = [];
  let ended = false;
  const onData = (d) => {
    buf = Buffer.concat([buf, d]);
    let i;
    while ((i = buf.indexOf(10)) >= 0) {
      const line = buf.subarray(0, i).toString("utf8");
      buf = buf.subarray(i + 1);
      let m = null;
      try {
        m = JSON.parse(line);
      } catch {
      }
      if (waiters.length) waiters.shift().res(m);
      else queue.push(m);
      if (once) {
        s.off("data", onData);
        s.pause();
        return;
      }
    }
    if (buf.length > 1 << 20) s.destroy();
  };
  s.on("data", onData);
  const end = () => {
    ended = true;
    while (waiters.length) waiters.shift().rej(new Error("closed"));
  };
  s.on("end", end);
  s.on("close", end);
  return {
    next(timeout) {
      if (queue.length) return Promise.resolve(queue.shift());
      if (ended) return Promise.reject(new Error("closed"));
      return new Promise((res, rej) => {
        const w = { res, rej };
        waiters.push(w);
        if (timeout > 0) {
          const t = setTimeout(() => {
            const i = waiters.indexOf(w);
            if (i >= 0) waiters.splice(i, 1);
            rej(new Error("timeout"));
          }, timeout);
          t.unref?.();
        }
      });
    },
    rest() {
      s.off("end", end);
      s.off("close", end);
      const r = buf;
      buf = Buffer.alloc(0);
      return r;
    }
  };
}
function localSso(authenticatedUrl, local, base) {
  const pub = new URL(base);
  const u = new URL(String(authenticatedUrl(new URL("/", pub))));
  return new Promise((res, rej) => {
    const req = http2.request({ host: local.host, port: local.port, path: u.pathname + u.search, method: "GET", headers: { host: pub.host, "x-forwarded-proto": pub.protocol.replace(":", ""), "x-forwarded-host": pub.host, accept: "text/html" }, timeout: 8e3 }, (r) => {
      r.resume();
      const sc = r.headers["set-cookie"] || [];
      if ((r.statusCode || 0) >= 400 || !sc.length) {
        const e = new Error("no session cookie");
        e.code = "status-" + r.statusCode;
        return rej(e);
      }
      res(sc);
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (e) => rej(Object.assign(new Error("local request failed"), { code: e.code })));
    req.end();
  });
}
function metrics(prev) {
  const cpus = os.cpus();
  let idle = 0, total = 0;
  for (const c of cpus) {
    for (const k of Object.keys(c.times)) total += c.times[k];
    idle += c.times.idle;
  }
  const cpu = prev && total > prev.total ? Math.round((1 - (idle - prev.idle) / (total - prev.total)) * 100) : null;
  return { snap: { t: Date.now(), idle, total }, m: { cpu, memUsed: Math.round((1 - os.freemem() / os.totalmem()) * 100), load: os.loadavg()[0], uptime: Math.round(os.uptime()), rss: Math.round(process.memoryUsage().rss / 1048576), platform: process.platform, arch: process.arch } };
}

// src/hosts.ts
import { readFileSync as readFileSync2, writeFileSync as writeFileSync2, existsSync as existsSync2, copyFileSync } from "node:fs";
var CONN = "@deepseek-ai/dsh-client-connection";
var SPREAD = "...ctx.webStartup.trustedHosts";
var HOST_RE = /^[a-z0-9.-]+$/;
function parseList(expr) {
  const m = /^\s*\[(.*)\]\s*$/s.exec(expr);
  if (!m) return null;
  const items = [];
  for (const raw of m[1].split(",").map((s) => s.trim()).filter(Boolean)) {
    const q = /^(['"])(.*)\1$/.exec(raw);
    if (q) items.push(q[2]);
    else if (raw === SPREAD) items.push(SPREAD);
    else return null;
  }
  return items;
}
function render(items) {
  return `!!js "[${items.map((h) => h === SPREAD ? SPREAD : `'${h}'`).join(", ")}]"`;
}
function applyHosts(text2, desired, managed) {
  for (const h of [...desired, ...managed]) if (!HOST_RE.test(h)) return { error: "invalid host " + h };
  const lines = text2.split("\n");
  const nameIdx = lines.findIndex((l) => l.includes(CONN) && /^\s+name:/.test(l));
  const want = (current) => {
    const keep = current.filter((h) => h === SPREAD || !managed.includes(h) || desired.includes(h));
    for (const d of desired) if (!keep.includes(d)) keep.splice(keep.indexOf(SPREAD) >= 0 ? keep.indexOf(SPREAD) : keep.length, 0, d);
    if (!keep.includes(SPREAD)) keep.push(SPREAD);
    return keep;
  };
  if (nameIdx < 0) {
    const items2 = want([]);
    const block = ["- id: connection", `  name: '${CONN}'`, "  config:", `    trustedHosts: ${render(items2)}`];
    return { text: (text2 && !text2.endsWith("\n") ? text2 + "\n" : text2) + block.join("\n") + "\n", hosts: items2 };
  }
  let start = nameIdx;
  while (start > 0 && !/^-\s/.test(lines[start])) start--;
  let end = start + 1;
  while (end < lines.length && !/^\S/.test(lines[end])) end++;
  const thIdx = lines.slice(start, end).findIndex((l) => /^\s+trustedHosts:/.test(l));
  if (thIdx >= 0) {
    const i = start + thIdx;
    const m = /^(\s+trustedHosts:\s*)!!js\s+"(.*)"\s*$/.exec(lines[i]);
    if (!m) return { error: "unrecognised trustedHosts format" };
    const cur = parseList(m[2]);
    if (!cur) return { error: "unrecognised trustedHosts list" };
    const items2 = want(cur);
    lines[i] = m[1] + render(items2);
    return { text: lines.join("\n"), hosts: items2 };
  }
  const cfgIdx = lines.slice(start, end).findIndex((l) => /^\s+config:\s*$/.test(l));
  const items = want([]);
  if (cfgIdx >= 0) {
    lines.splice(start + cfgIdx + 1, 0, `    trustedHosts: ${render(items)}`);
    return { text: lines.join("\n"), hosts: items };
  }
  if (lines.slice(start, end).some((l) => /^\s+config:/.test(l))) return { error: "inline config block" };
  lines.splice(end, 0, "  config:", `    trustedHosts: ${render(items)}`);
  return { text: lines.join("\n"), hosts: items };
}
function syncHostsFile(file, desired, managed) {
  const before = existsSync2(file) ? readFileSync2(file, "utf8") : "";
  const r = applyHosts(before, desired, managed);
  if ("error" in r) return { changed: false, hosts: [], manual: `\u65E0\u6CD5\u81EA\u52A8\u4FEE\u6539\uFF08${r.error}\uFF09\uFF0C\u8BF7\u624B\u52A8\u628A ${desired.join(", ")} \u52A0\u5165 connection.trustedHosts` };
  if (r.text === before) return { changed: false, hosts: r.hosts };
  let backup;
  if (before) {
    backup = `${file}.remote-agent-bak-${(/* @__PURE__ */ new Date()).toISOString().replace(/[-:T]/g, "").slice(0, 14)}`;
    copyFileSync(file, backup);
  }
  writeFileSync2(file, r.text);
  const check = readFileSync2(file, "utf8");
  if (!desired.every((d) => check.includes(`'${d}'`))) {
    if (backup) copyFileSync(backup, file);
    return { changed: false, hosts: [], manual: "\u5199\u5165\u6821\u9A8C\u5931\u8D25\uFF0C\u5DF2\u56DE\u6EDA" };
  }
  return { changed: true, hosts: r.hosts, backup };
}

// src/route.ts
var SEG = /^[A-Za-z0-9_$.-]+$/;
function registerControlRoute(prefix, connection, webServer, handler) {
  if (webServer && typeof webServer.register === "function" && connection && typeof connection.requestRejection === "function") {
    return webServer.register({ kind: "prefix", path: prefix, handler: (req, res) => handle(prefix, connection, handler, req, res) });
  }
  if (connection && connection.rpc && typeof connection.rpc.handle === "function") return connection.rpc.handle(prefix, async (ep, p) => wrap(handler, ep, p), { authority: "loopback" });
  return void 0;
}
async function wrap(handler, ep, p) {
  try {
    return { ok: true, value: await handler(ep, p || {}) };
  } catch (e) {
    return { ok: false, error: { code: "dsh-remote-agent/error", message: String(e && e.message || e) } };
  }
}
async function handle(prefix, connection, handler, req, res) {
  const rej = connection.requestRejection(req);
  if (rej !== void 0) {
    res.writeHead(rej);
    res.end(rej === 401 ? "unauthorized" : "forbidden");
    return;
  }
  const path2 = new URL(req.url || "/", "http://dsh.internal").pathname;
  const ep = path2.startsWith(prefix + "/") ? path2.slice(prefix.length + 1) : "";
  if (!ep || ep.split("/").some((s) => !SEG.test(s) || s === "." || s === "..")) return text(res, 404, "not found");
  if (req.method !== "POST") return text(res, 405, "method not allowed");
  const ct = String([].concat(req.headers["content-type"] || "")[0]).split(";")[0].trim().toLowerCase();
  if (ct !== "application/json") return text(res, 415, "content type must be application/json");
  let body;
  try {
    const chunks = [];
    for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return text(res, 400, "body is not JSON");
  }
  const rpcId = body && typeof body.rpcId === "string" ? body.rpcId : "invalid-request";
  if (!body || body.type !== "client-request" || typeof body.method !== "string" || body.method !== ep) {
    return json(res, { type: "server-response", rpcId, result: { ok: false, error: { code: "gateway/bad-request", message: "invalid client-request message", details: { issues: [] } } } });
  }
  json(res, { type: "server-response", rpcId, result: await wrap(handler, ep, body.payload) });
}
function json(res, body) {
  res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}
function text(res, code, s) {
  res.writeHead(code);
  res.end(s);
}

// src/schema.ts
var Schema = null;
try {
  ({ default: Schema } = await import("@deepseek-ai/schemastery"));
} catch {
}
function buildConfig(z) {
  return z.object({
    hub: z.string().default("https://remote.zhuhedong.cn").description("Hub \u5730\u5740"),
    instanceName: z.string().default("").description("\u5B9E\u4F8B\u540D\u79F0\uFF08\u7559\u7A7A\u7528\u4E3B\u673A\u540D\uFF0C\u767B\u8BB0\u65F6\u751F\u6548\uFF09"),
    autoConnect: z.boolean().default(true).description("DSH \u542F\u52A8\u65F6\u81EA\u52A8\u8FDE\u63A5 Hub"),
    proxy: z.string().default("system").description("\u4EE3\u7406\uFF1Asystem\uFF08\u73AF\u5883\u53D8\u91CF/\u7CFB\u7EDF\u4EE3\u7406\uFF0C\u5982 Clash\uFF09| direct | http://127.0.0.1:7890"),
    manageTrustedHosts: z.boolean().default(true).description("\u81EA\u52A8\u628A\u672C\u673A\u8BBF\u95EE\u57DF\u540D\u52A0\u5165 DSH trustedHosts"),
    keyStore: z.union([z.const("auto"), z.const("file")]).default("auto").description("\u8BBE\u5907\u5BC6\u94A5\u5B58\u50A8\uFF1Aauto\uFF08macOS \u94A5\u5319\u4E32\uFF0C\u5931\u8D25\u7528\u52A0\u5BC6\u6587\u4EF6\uFF09| file"),
    remoteRestart: z.boolean().default(false).description("\u5141\u8BB8\u8FDC\u7A0B\u89E6\u53D1 dsh.restart \u95F8\u95E8\uFF08\u9ED8\u8BA4\u5173\uFF1BA0.4 \u4ECD\u4E0D\u771F\u6B63\u91CD\u542F\uFF09"),
    allowPluginReload: z.boolean().default(false).description("\u5141\u8BB8 plugin.reload \u95F8\u95E8\uFF08\u9ED8\u8BA4\u5173\uFF1B\u70ED\u91CD\u8F7D\u672A\u63A5\u7EBF\uFF09"),
    allowPluginUpdate: z.boolean().default(false).description("\u5141\u8BB8 plugin.update \u95F8\u95E8\uFF08\u9ED8\u8BA4\u5173\uFF1B\u9A8C\u7B7E\u5347\u7EA7\u672A\u63A5\u7EBF\uFF09")
  }).description("DSH \u8FDC\u7A0B\u7BA1\u7406 \xB7 \u8FDE\u63A5\u5230\u81EA\u5EFA Hub");
}
var Config = Schema ? buildConfig(Schema) : void 0;

// src/index.ts
var name = "dsh-remote-agent";
var PREFIX = "/dsh-remote-agent";
var VERSION = "0.2.3";
var LEGACY_HOSTS = ["dsh.cli-help.com"];
var here = () => {
  try {
    return dirname2(fileURLToPath(import.meta.url));
  } catch {
    return process.cwd();
  }
};
function profileDir() {
  return process.env.DSH_REMOTE_AGENT_PROFILE || join2(here(), "..", "..");
}
function dataDir() {
  return process.env.DSH_REMOTE_AGENT_DIR || join2(profileDir(), ".dsh-remote-agent");
}
function patchFile() {
  return process.env.DSH_REMOTE_AGENT_PATCH || join2(profileDir(), "cordis.patch.yml");
}
function loadState() {
  try {
    return JSON.parse(readFileSync3(join2(dataDir(), "state.json"), "utf8"));
  } catch {
    return {};
  }
}
function saveState(s) {
  mkdirSync2(dataDir(), { recursive: true, mode: 448 });
  writeFileSync3(join2(dataDir(), "state.json"), JSON.stringify(s, null, 2), { mode: 384 });
}
function logger(ctx) {
  const l = ctx && ctx.logger;
  const pick = (lvl) => (msg) => {
    const text2 = `[remote-agent] ${redact(msg)}`;
    try {
      if (l && typeof l[lvl] === "function") return l[lvl](text2);
    } catch {
    }
    (lvl === "warn" ? console.warn : console.log)(text2);
  };
  return { info: pick("info"), warn: pick("warn") };
}
function normalizeConfig(raw) {
  const c = raw || {};
  return {
    hub: String(c.hub || "https://remote.zhuhedong.cn").replace(/\/+$/, ""),
    instanceName: String(c.instanceName || os2.hostname().replace(/\.local$/, "")),
    autoConnect: c.autoConnect !== false,
    proxy: String(c.proxy || "system"),
    manageTrustedHosts: c.manageTrustedHosts !== false,
    keyStore: c.keyStore === "file" ? "file" : "auto",
    remoteRestart: c.remoteRestart === true,
    allowPluginReload: c.allowPluginReload === true,
    allowPluginUpdate: c.allowPluginUpdate === true
  };
}
function apply(ctx, rawConfig) {
  const log = logger(ctx);
  const cfg = normalizeConfig(rawConfig);
  let state = loadState();
  let local = null;
  let connSvc = null;
  let link = null;
  let store = null;
  let snap = null;
  const recent = [];
  const logRing = new LogRing(500);
  const note = (text2) => {
    const safe = redact(text2);
    recent.unshift({ ts: Date.now(), text: safe });
    recent.length = Math.min(recent.length, 20);
    logRing.push(safe, "agent");
  };
  const _info = log.info.bind(log), _warn = log.warn.bind(log);
  log.info = (m) => {
    _info(m);
    try {
      logRing.push(m, "info");
    } catch {
    }
  };
  log.warn = (m) => {
    _warn(m);
    try {
      logRing.push(m, "warn");
    } catch {
    }
  };
  const getStore = async () => store ||= await pickStore(dataDir(), cfg.keyStore === "file" ? "file" : void 0);
  const syncHosts = (hosts) => {
    if (!cfg.manageTrustedHosts || !hosts.length) return;
    try {
      const managed = [.../* @__PURE__ */ new Set([...state.managedHosts || [], ...hosts])];
      const desired = [.../* @__PURE__ */ new Set([...hosts, ...(state.managedHosts || []).filter((h) => LEGACY_HOSTS.includes(h))])];
      try {
        const t = readFileSync3(patchFile(), "utf8");
        for (const h of LEGACY_HOSTS) if (t.includes(`'${h}'`) && !managed.includes(h)) {
          managed.push(h);
          desired.push(h);
        }
      } catch {
      }
      const r = syncHostsFile(patchFile(), desired, managed);
      state = { ...state, hosts, managedHosts: managed, restartNeeded: state.restartNeeded || r.changed };
      saveState(state);
      if (r.changed) {
        log.info(`\u5DF2\u66F4\u65B0 trustedHosts\uFF08\u5907\u4EFD ${r.backup || "\u65E0"}\uFF09\uFF0C\u9700\u91CD\u542F DSH \u751F\u6548`);
        note("trustedHosts \u5DF2\u66F4\u65B0\uFF0C\u9700\u91CD\u542F DSH");
      }
      if (r.manual) log.warn(r.manual);
    } catch (e) {
      log.warn(`trustedHosts \u66F4\u65B0\u5931\u8D25: ${e.message}`);
    }
  };
  let sessionCtl = null;
  const chat = new ChatBridge(() => sessionCtl);
  let starting = null;
  const startLink = () => starting ??= startLinkOnce().finally(() => {
    starting = null;
  });
  const startLinkOnce = async () => {
    if (link || !state.deviceId || !state.hub || state.revoked) return;
    const pkcs8 = await (await getStore()).load();
    if (link || state.revoked) return;
    if (!pkcs8) {
      log.warn("\u672A\u627E\u5230\u8BBE\u5907\u5BC6\u94A5\uFF0C\u8BF7\u91CD\u65B0\u767B\u8BB0");
      return;
    }
    const { priv } = loadKey(pkcs8);
    const bridge = new BridgeRouter({
      status: () => {
        const r = metrics(snap);
        snap = r.snap;
        return { ...r.m, dshReady: Boolean(local), restartNeeded: Boolean(state.restartNeeded), plugin: VERSION, rtt: link ? link.rtt : null };
      },
      enrollment: () => ({
        hub: state.hub || null,
        deviceId: state.deviceId || null,
        name: state.name || cfg.instanceName,
        slug: state.slug || null,
        fingerprint: state.fingerprint || null,
        fingerprintPrefix: state.fingerprint ? String(state.fingerprint).slice(0, 12) : null,
        state: link ? link.state : state.deviceId ? "stopped" : "not-enrolled",
        lastError: link ? link.lastError : null,
        since: link ? link.since : null,
        rtt: link ? link.rtt : null,
        hosts: state.hosts || (link ? link.hosts : []) || [],
        keyStore: store ? store.kind : state.keyStore || null,
        dshReady: Boolean(local),
        plugin: VERSION
      }),
      logs: { tail: (n) => logRing.tail(n) },
      chat,
      local: () => local,
      linkState: () => link ? link.state : null,
      opsPolicy: () => ({
        remoteRestart: cfg.remoteRestart === true,
        allowPluginReload: cfg.allowPluginReload === true,
        allowPluginUpdate: cfg.allowPluginUpdate === true
      }),
      log
    });
    link = new HubLink({
      hub: state.hub,
      deviceId: state.deviceId,
      key: priv,
      proxy: cfg.proxy,
      versions: { plugin: VERSION, node: process.versions.node, os: `${process.platform}-${process.arch}` },
      local: () => local,
      sso: async (base) => {
        if (!connSvc || typeof connSvc.authenticatedUrl !== "function" || !local) throw Object.assign(new Error("sso unavailable"), { code: "unavailable" });
        const ok = state.hosts && state.hosts.some((h) => new URL(base).host === h);
        if (!ok) throw Object.assign(new Error("unexpected host"), { code: "host" });
        const r = await localSso((u) => connSvc.authenticatedUrl(u), local, base);
        note("\u8FDC\u7A0B\u767B\u5F55 DSH\uFF08\u514D\u4E8C\u6B21\u767B\u5F55\uFF09");
        return r;
      },
      status: () => {
        const r = metrics(snap);
        snap = r.snap;
        return { ...r.m, dshReady: Boolean(local), restartNeeded: Boolean(state.restartNeeded), plugin: VERSION };
      },
      bridge,
      log
    });
    link.on("welcome", (w) => {
      if (w.slug) {
        state = { ...state, slug: w.slug };
        saveState(state);
      }
      syncHosts(link.hosts);
    });
    link.on("revoked", async () => {
      log.warn("\u8BBE\u5907\u5DF2\u5728 Hub \u88AB\u79FB\u9664\uFF0C\u6E05\u9664\u672C\u673A\u5BC6\u94A5");
      note("\u8BBE\u5907\u5DF2\u88AB Hub \u79FB\u9664");
      try {
        await (await getStore()).clear();
      } catch {
      }
      state = { ...state, revoked: true, deviceId: void 0 };
      saveState(state);
    });
    link.start();
  };
  const stopLink = () => {
    if (link) {
      link.stop();
      link = null;
    }
  };
  const view = async () => ({
    version: VERSION,
    hub: state.hub || cfg.hub,
    name: state.name || cfg.instanceName,
    enrolled: Boolean(state.deviceId),
    revoked: Boolean(state.revoked),
    fingerprint: state.fingerprint || null,
    state: link ? link.state : state.deviceId ? "stopped" : "not-enrolled",
    lastError: link ? link.lastError : null,
    since: link ? link.since : null,
    rtt: link ? link.rtt : null,
    url: state.hosts && state.hosts[0] ? `https://${state.hosts[0]}` : null,
    keyStore: store ? store.kind : state.keyStore || null,
    dshReady: Boolean(local),
    restartNeeded: Boolean(state.restartNeeded),
    managedHosts: state.managedHosts || [],
    recent: recent.slice(0, 10)
  });
  const handler = async (ep, p = {}) => {
    switch (ep) {
      case "status":
        return view();
      case "enroll": {
        const hub = String(p.hub || cfg.hub).trim().replace(/\/+$/, "");
        if (!/^https:\/\//.test(hub) && !(process.env.DSH_REMOTE_AGENT_ALLOW_HTTP === "1" && /^http:\/\//.test(hub))) throw new Error("Hub \u5730\u5740\u5FC5\u987B\u662F https://");
        const code = String(p.code || "").trim();
        if (!code) throw new Error("\u8BF7\u586B\u5199\u767B\u8BB0\u7801");
        addSecret(code);
        stopLink();
        const k = newDeviceKey();
        const proxy = await resolveProxy(cfg.proxy, hub);
        const r = await postJSON(hub + "/agent/enroll", { code, pubkey: k.pub, hostname: os2.hostname(), versions: { plugin: VERSION, node: process.versions.node } }, agentFor(proxy));
        if (r.status !== 200) throw new Error("\u767B\u8BB0\u5931\u8D25\uFF1A" + (r.json && r.json.error ? r.json.error : "HTTP " + r.status));
        const st = await getStore();
        await st.save(k.pkcs8);
        state = { hub, deviceId: r.json.deviceId, name: r.json.name, slug: r.json.slug, fingerprint: r.json.fingerprint, keyStore: st.kind, managedHosts: state.managedHosts || [], restartNeeded: state.restartNeeded };
        saveState(state);
        syncHosts(r.json.hosts || []);
        note("\u5DF2\u767B\u8BB0\u5230 " + hub);
        await startLink();
        return view();
      }
      case "connect":
        state.revoked = false;
        await startLink();
        link?.ensureConnected();
        return view();
      case "disconnect":
        stopLink();
        return view();
      case "forget":
        stopLink();
        try {
          await (await getStore()).clear();
        } catch {
        }
        state = { managedHosts: state.managedHosts, restartNeeded: state.restartNeeded };
        saveState(state);
        return view();
      case "restart.done":
        state.restartNeeded = false;
        saveState(state);
        return view();
      default:
        throw new Error("unknown endpoint " + ep);
    }
  };
  if (typeof ctx.inject === "function") {
    try {
      ctx.inject(["webServer"], (w) => {
        const run2 = () => {
          const ws = w.webServer;
          const port = Number(ws && ws.port);
          if (!port) {
            log.warn("webServer \u672A\u63D0\u4F9B\u7AEF\u53E3");
            return;
          }
          const h = String(ws.host || "");
          local = { host: !h || h === "0.0.0.0" || h === "::" ? "127.0.0.1" : h, port };
          return () => {
            local = null;
          };
        };
        if (typeof w.effect === "function") w.effect(run2);
        else run2();
      });
    } catch (e) {
      log.warn(`\u65E0\u6CD5\u6CE8\u5165 webServer: ${e.message}`);
    }
    try {
      ctx.inject(["sessionController"], (c) => {
        const run2 = () => {
          sessionCtl = c.sessionController || null;
          if (sessionCtl) log.info("A1: sessionController \u5DF2\u63A5\u5165");
          return () => {
            chat.dispose();
            sessionCtl = null;
          };
        };
        if (typeof c.effect === "function") c.effect(run2);
        else run2();
      });
    } catch (e) {
      log.warn(`A1 sessionController \u4E0D\u53EF\u7528: ${e.message}`);
    }
    try {
      ctx.inject(["userQuestions"], (c) => {
        const run2 = () => {
          const uq = c.userQuestions || null;
          chat.setUserQuestions(() => uq);
          if (uq) log.info("A1: userQuestions \u5DF2\u63A5\u5165\uFF08\u652F\u6301\u8D85\u65F6\u540E\u8865\u7B54\uFF09");
          return () => {
            chat.setUserQuestions(() => null);
          };
        };
        if (typeof c.effect === "function") c.effect(run2);
        else run2();
      });
    } catch (e) {
      log.warn(`userQuestions \u4E0D\u53EF\u7528: ${e.message}`);
    }
    try {
      if (typeof ctx.on === "function") {
        ctx.on("user-questions/request", (request, next) => chat.raceUserQuestion(request, next));
        log.info("A1: \u5DF2\u6CE8\u518C user-questions/request\uFF08\u624B\u673A\u53EF\u7B54 ask_user_question\uFF09");
      }
    } catch (e) {
      log.warn(`\u6CE8\u518C user-questions/request \u5931\u8D25: ${e.message}`);
    }
    try {
      ctx.inject(["connection", "webServer"], (c) => {
        const run2 = () => {
          connSvc = c.connection;
          const d = registerControlRoute(PREFIX, c.connection, c.webServer, handler);
          if (!d) log.warn("\u65E0\u6CD5\u6CE8\u518C\u63A7\u5236\u8DEF\u7531");
          return () => {
            connSvc = null;
            if (typeof d === "function") d();
          };
        };
        if (typeof c.effect === "function") c.effect(run2);
        else run2();
      });
    } catch (e) {
      log.warn(`\u6CE8\u518C\u63A7\u5236\u901A\u9053\u5931\u8D25: ${e.message}`);
    }
    try {
      ctx.inject(["commands"], (c) => {
        try {
          return c.commands.register({
            name: "remote",
            description: "DSH Remote: status | connect | disconnect",
            input: { hint: "status | connect | disconnect" },
            async handler(inv) {
              const sub = String(inv && inv.rawInput || "status").trim().split(/\s+/)[0] || "status";
              if (!["status", "connect", "disconnect"].includes(sub)) return { kind: "error", text: "\u7528\u6CD5: /remote status|connect|disconnect" };
              const v = await handler(sub, {});
              return { kind: "success", text: `Hub: ${v.hub}
\u72B6\u6001: ${v.state}${v.lastError ? "\uFF08" + v.lastError + "\uFF09" : ""}
\u8BBF\u95EE\u5730\u5740: ${v.url || "-"}${v.restartNeeded ? "\n\u63D0\u793A: trustedHosts \u5DF2\u66F4\u65B0\uFF0C\u9700\u91CD\u542F DSH" : ""}` };
            }
          });
        } catch (e) {
          log.warn(`\u6CE8\u518C /remote \u547D\u4EE4\u5931\u8D25: ${e.message}`);
        }
      });
    } catch {
    }
  }
  if (cfg.autoConnect && state.deviceId && !state.revoked) startLink().catch((e) => log.warn(`\u542F\u52A8\u8FDE\u63A5\u5931\u8D25: ${e.message}`));
  const cleanup = () => {
    stopLink();
  };
  process.once("exit", cleanup);
  if (typeof ctx.on === "function") {
    try {
      ctx.on("dispose", () => {
        process.removeListener("exit", cleanup);
        cleanup();
      });
    } catch {
    }
  }
  void Config;
  return { handler, cleanup, _state: () => state, _link: () => link };
}
apply.inject = [];
var index_default = apply;
export {
  Config,
  PREFIX,
  VERSION,
  apply,
  dataDir,
  index_default as default,
  name,
  normalizeConfig,
  patchFile,
  profileDir
};
