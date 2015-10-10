/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

Instances.register("Timer", "@mozilla.org/timer;1", "nsITimer", "init");

const {
  TYPE_ONE_SHOT,
  TYPE_REPEATING_SLACK
} = Ci.nsITimer;

const CLAMP = globalPrefs.dom.min_timeout_value;

function uuid() {
  return Services.uuid.generateUUID().toString();
}

let timers = Object.create(Object.prototype, {
  create: {value: function(type, func, delay, args) {
    let id = uuid();
    let timer = new Instances.Timer({
      observe: function() {
        log(LOG_DEBUG, "timer " + id + "fired delay: " + delay +
            " type:" + type);
        try {
          func.apply(null, args);
        }
        finally {
          if (type == TYPE_ONE_SHOT) {
            delete this[id];
          }
        }
      }
    }, delay, type);
    this[id] = timer;
    log(LOG_DEBUG, "timer " + id + " created delay: " + delay +
        " type:" + type);
    return id;
  }},
  destroy: {value: function(id) {
    if (id in this) {
      try {
        this[id].cancel();
      } catch (ex) {}
      delete this[id];
      log(LOG_DEBUG, "timer " + id + " destroyed");
    }
  }}
});
unload(function unload_timers() {
  for (let [id,timer] in new Iterator(timers)) {
      try {
        timer.cancel();
      } catch (ex) {}
      delete timers[id];
  }
});

Object.defineProperties(exports, {
  createTimeout: {
    value: function createTimeout(func, delay /*, ... */) {
      let args = Array.slice(2);
      return timers.create(TYPE_ONE_SHOT, func, Math.max(delay, CLAMP), args);
    },
    enumerable: true
  },
  createInterval: {
    value: function createInterval(func, delay /*, ... */) {
      let args = Array.slice(2);
      return timers.create(TYPE_REPEATING_SLACK, func,
                           Math.max(delay, CLAMP), args);
    },
    enumerable: true
  },
  defer: {
    value: function defer(func /*. ... */) {
      let args = Array.slice(1);
      return timers.create(TYPE_ONE_SHOT, func, 0, args);
    },
    enumerable: true
  },
  destroy: {
    value: id => timers.destroy(id),
    enumerable: true
  }
});
Object.freeze(exports);

/* vim: set et ts=2 sw=2 : */
