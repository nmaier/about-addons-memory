/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const {registerOverlay, unloadWindow} = require("sdk/windows");
registerOverlay(
  "overlay.xul",
  "chrome://browser/content/browser.xul",
  function main(window, document) {
    function $(id) document.getElementById(id);
    function $$(q) document.querySelector(q);
    function $$$(q) document.querySelectorAll(q);
    function fe() document.commandDispatcher.focusedElement;

    log(LOG_INFO, "all good!");
});

/* vim: set et ts=2 sw=2 : */
