/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const global = this;

function install() {}
function uninstall() {}
function startup(data) {
  // will unload itself
  Components.utils.import("chrome://about-addons-memory/content/loader.jsm");
  _setupLoader(data, function real_startup() {
    try {
      require("main");
    }
    catch (ex) {
      Components.utils.reportError(ex);
    }
  });
}
function shutdown(reason) {
  if (reason === APP_SHUTDOWN) {
    // No need to cleanup; stuff will vanish anyway
    return;
  }
  unload("shutdown");
}

/* vim: set et ts=2 sw=2 : */
