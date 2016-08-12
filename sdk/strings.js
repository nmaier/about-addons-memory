/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var bundleFlush = null;

function Bundle(uri) {
  lazy(this, "_bundle", function() {
    if (!bundleFlush) {
      bundleFlush = unload(() => Services.strings.flushBundles());
    }
    log(LOG_DEBUG, `loading bundle ${uri}`);
    return Services.strings.createBundle(uri);
  });
  this._dict = Object.create(null);
}
Bundle.prototype = {
  getString: function getString(id /*, args */) {
    if (arguments.length > 1) {
      let args = Array.slice(arguments, 1);
      return this._bundle.formatStringFromName(id, args, args.length);
    }
    return this._bundle.GetStringFromName(id);
  }
};

Object.defineProperty(exports, "getBundle", {value: uri => {
  let bundle = new Bundle(uri);
  let rv = bundle.getString.bind(bundle);
  rv.getString = rv;
  return rv;
}});

/* vim: set et ts=2 sw=2 : */
