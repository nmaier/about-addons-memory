/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

Cu.importGlobalProperties(["XMLHttpRequest", "Blob", "File"]);

exports.Blob = Blob;
exports.File = File;
exports.xhr = exports.XMLHttpRequest = XMLHttpRequest;

function Callbacks(underlay) {
  try {
    this.underlay = underlay.QueryInterface(Ci.nsIInterfaceRequestor);
  }
  catch (ex) {
    this.underlay = null;
  }
}
Callbacks.prototype = {
  badHost: null,
  getInterface: function(iid) {
    try {
      return this.QueryInterface(iid);
    }
    catch (ex) {
      if (this.underlay) {
        return this.underlay.getInterface(iid);
      }
      throw ex;
    }
  },
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIBadCertListener2, Ci.nsIInterfaceRequestor]),
  notifyCertProblem: function(si, status, host) {
    this.badHost = host;
    return false;
  }
};

exports.request = (method, url, data, options) => {
  options = options || {};
  return new Promise((resolve, reject) => {
    let req = new XMLHttpRequest();
    let cbs = null;
    try {
      url = url.spec || url;
      if (method == "POST" && !data) {
        let [u, ...pieces] = url.split("?");
        url = u;
        data = pieces.length && pieces.join("?") || null;
      }
      req.timeout = options.timeout || 10000;
      if (options.mime) {
        req.overrideMimeType(options.mime);
      }
      if (options.type) {
        req.responseType = options.type;
      }
      else {
        req.responseType = "json";
      }
      if (options.setup) {
        options.setup(req);
      }
      req.addEventListener("loadend", function end() {
        req.removeEventListener("loadend", end, false);
        try {
          if (req.status < 100 || req.status >= 400) {
            if (cbs && cbs.badHost) {
              throw new Error(`${cbs.badHost} has an invalid TLS Certificate`);
            }
            throw new Error("Bad response");
          }
          log(LOG_DEBUG, `request to ${url} resolved`);
          resolve(req);
        }
        catch (ex) {
          log(LOG_DEBUG, `request to ${url} rejected ${ex}`);
          reject(ex);
        }
      }, false);
      log(LOG_DEBUG, `Making request to ${url} w/ data ${data}`);
      req.open(method, url);
      if (req.channel) {
        try {
          cbs = new Callbacks(req.channel.notificationCallbacks);
          req.channel.notificationCallbacks = cbs;
        }
        catch (ex) {
          log(LOG_DEBUG, "Failed to set callbacks", ex);
        }
        if (req.channel instanceof Ci.nsIHttpChannel) {
          if (options.cookies) {
            for (let n of Object.keys(options.cookies)) {
              req.channel.setRequestHeader("Cookie", `${encodeURIComponent(n)}=${encodeURIComponent(options.cookies[n])}`, true);
            }
          }
          if (options.headers) {
            for (let n of Object.keys(options.headers)) {
              let h = options.headers[n];
              let merge = true;
              if (Array.isArray(h)) {
                merge = !!h[1];
                h = h[0];
              }
              req.channel.setRequestHeader(n, h, merge);
            }
          }
        }
      }
      req.send(data || null);
    }
    catch (ex) {
      reject(ex);
    }
  });
};

/* vim: set et ts=2 sw=2 : */
