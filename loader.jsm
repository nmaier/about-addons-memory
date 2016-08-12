/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var EXPORTED_SYMBOLS = ["BASE_PATH", "require", "unload", "_setupLoader"];

var {
  classes: Cc,
  interfaces: Ci,
  utils: Cu,
  results: Cr,
  Constructor: ctor,
  manager: Cm
} = Components;

var weak = Cu.getWeakReference.bind(Cu);
var reportError = Cu.reportError.bind(Cu);

Cm.QueryInterface(Ci.nsIComponentRegistrar);

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

var lazy = XPCOMUtils.defineLazyGetter;

// hide our internals
// Since require() uses .scriptloader, the loaded require scopes will have
// access to the named stuff within this module scope, but we actually want
// them to have access to certain stuff.
(function setup_scope(exports) {
  Services = exports.Services = Object.create(Services);
  var dlsg = XPCOMUtils.defineLazyServiceGetter.bind(XPCOMUtils, Services);
  dlsg("catman", "@mozilla.org/categorymanager;1", "nsICategoryManager");
  dlsg("clipbrd", "@mozilla.org/widget/clipboard;1", "nsIClipboard");
  dlsg("drags", "@mozilla.org/widget/dragservice;1", "nsIDragService");
  dlsg("eps", "@mozilla.org/uriloader/external-protocol-service;1",
       "nsIExternalProtocolService");
  dlsg("fixups", "@mozilla.org/docshell/urifixup;1", "nsIURIFixup");
  dlsg("memrm", "@mozilla.org/memory-reporter-manager;1",
       "nsIMemoryReporterManager");
  dlsg("mime", "@mozilla.org/uriloader/external-helper-app-service;1",
       "nsIMIMEService");
  dlsg("mimeheader", "@mozilla.org/network/mime-hdrparam;1",
       "nsIMIMEHeaderParam");
  dlsg("sysprincipal", "@mozilla.org/systemprincipal;1", "nsIPrincipal");
  dlsg("uuid", "@mozilla.org/uuid-generator;1", "nsIUUIDGenerator");

  const Instances = exports.Instances = {
    get: function I_get(symbol, contract, iface, initializer) {
      if (!(symbol in this)) {
        this.register(symbol, contract, iface, initializer);
      }
      return this[symbol];
    },
    register: function I_register(symbol, contract, iface, initializer) {
      if (symbol in this) {
        var msg = "Symbol " + symbol + " already in Instances";
        log(LOG_ERROR, msg);
        throw new Error(msg);
      }
      if (initializer) {
        lazy(this, symbol, () => ctor(contract, iface, initializer));
        lazy(this, symbol + "_p", () => ctor(contract, iface));
      }
      else {
        lazy(this, symbol, () => ctor(contract, iface));
        lazy(this, symbol.toLowerCase(), () => new (ctor(contract, iface))());
      }
    }
  };

  const {SELF_PATH, BASE_PATH} = (function() {
    var rv;
    try { throw new Error("narf"); }
    catch (ex) {
      rv = {
        SELF_PATH: ex.fileName,
        BASE_PATH: /^(.+\/).*?$/.exec(ex.fileName)[1]
      };
    }
    return rv;
  })();
  exports.BASE_PATH = BASE_PATH;

  // logging stubs
  var log = function() {}; // stub
  var LOG_DEBUG = 0, LOG_INFO = 0, LOG_ERROR = 0;

  var _unloaders = [];
  var _runUnloader = function _runUnloader(fn) {
      try {
        fn();
      }
      catch (ex) {
        log(LOG_ERROR, "unloader failed", ex);
      }
  };
  exports.unload = function unload(fn) {
    if (fn == "shutdown") {
      log(LOG_INFO, "shutdown");
      for (var i = _unloaders.length; ~(--i);) {
        _runUnloader(_unloaders[i]);
      }
      _unloaders.splice(0);
      return;
    }

    // add an unloader
    if (typeof(fn) != "function") {
      throw new Error("unloader is not a function");
    }
    _unloaders.push(fn);
    return function() {
      _runUnloader(fn);
      _unloaders = _unloaders.filter(c => c != fn);
    };
  };

  const _registry = new Map();
  exports.require = function require(mod) {
    mod = BASE_PATH + mod + ".js";

    // already loaded?
    var scope = _registry.get(mod);
    if (scope) {
      return scope.exports;
    }

    // try to load the mod
    log(LOG_DEBUG, "going to load: " + mod);
    scope = Object.create(exports);
    scope.exports = Object.create(null);
    try {
      scope = Cu.Sandbox(Services.sysprincipal, {
        sandboxName: mod,
        sandboxPrototype: scope,
        wantXRays: false
      });
      Services.scriptloader.loadSubScript(mod, scope, "utf-8");
    }
    catch (ex) {
      log(LOG_ERROR, "failed to load " + mod, ex);
      throw ex;
    }

    _registry.set(mod, scope);
    log(LOG_DEBUG, "loaded module: " + mod);

    return scope.exports;
  };

  exports.lazyRequire = function lazyRequire(mod) {
    function lazyBind(props, prop) {
      log(LOG_DEBUG, "lazily binding " + props + " for module " + mod);
      var m = require(mod);
      for (var [,p] in new Iterator(props)) {
        delete this[p];
        this[p] = m[p];
      }
      return this[prop];
    }

    // Already loaded?
    var scope = _registry.get(mod);
    if (scope) {
      return scope.exports;
    }

    var props = Array.slice(arguments, 1);
    var rv = {};
    var binder = lazyBind.bind(rv, props);
    for (var [,p] in new Iterator(props)) {
      var _p = p;
      lazy(rv, _p, () => binder(_p));
    }
    return rv;
  };

  unload(function() {
    for (var [mod, scope] of _registry) {
      _registry.delete(mod);
      Cu.nukeSandbox(scope);
    }
    if (_registry.clear) {
      _registry.clear();
    }
    // unload ourselves
    Cu.unload(SELF_PATH);
  });

  exports._setupLoader = function _setupLoader(data, callback) {
    delete exports._setupLoader;

    var _am = {};
    Cu.import("resource://gre/modules/AddonManager.jsm", _am);
    _am.AddonManager.getAddonByID(data.id, function loader_startup(addon) {
      exports.ADDON = addon;
      unload(() => delete exports.ADDON);

      var logging;
      try {
        logging = require("sdk/logging");
        for (var [k,v] in new Iterator(logging)) {
          exports[k] = v;
        }

        var prefs = require("sdk/preferences");
        exports.prefs = prefs.prefs;
        exports.globalPrefs = prefs.globalPrefs;

        try {
          prefs.prefs.observe("loglevel", 
            (p, v) => logging.setLogLevel(v),
            logging.LOG_NONE);
        }
        catch (ex) {
          logging.log(logging.LOG_ERROR, "failed to set log level", ex);
        }
      }
      catch (ex) {
        // probably do not have a working log() yet
        reportError(ex);
        return;
      }

      try {
        if (callback) {
          logging.log(logging.LOG_DEBUG, "loader: running callback");
          callback();
        }
      }
      catch (ex) {
        logging.log(logging.LOG_ERROR, "callback failed!", ex);
      }
      logging.log(logging.LOG_DEBUG, "loader: done");
    });
  };

})(this);

/* vim: set et ts=2 sw=2 : */
