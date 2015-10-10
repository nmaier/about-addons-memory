/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const manager = {
  topics: Object.create(null),
  observe: function observe(subject, topic, data) {
    let observers = this.topics[topic];
    if (!observers) {
      return;
    }
    for (let i = observers.length; ~(--i);) {
      try {
        observers[i].call(null, subject, topic, data);
      }
      catch (ex) {
        log(LOG_ERROR, "observer threw", ex);
      }
    }
  },
  add: function add(topic, cb) {
    try {
      this.topics[topic].push(cb);
    }
    catch (ex) {
      this.topics[topic] = [cb];
      Services.obs.addObserver(this, topic, false);
    }
  },
  remove: function remove(topic, cb) {
    let observers = this.topics[topic];
    if (!observers) {
      log(LOG_ERROR,
          "tried to remove a non-existant observer for topic: " + topic);
      return;
    }
    observers = this.topics[topic] = observers.filter(fn => fn != cb);
    if (!observers.length) {
      delete this.topics[topic];
      Services.obs.removeObserver(this, topic, false);
    }
  },
  teardown: function teardown() {
    for (let k in this.topics) {
      this.topics[k].splice(0);
      delete this.topics[k];
      Services.obs.removeObserver(this, k, false);
    }
  }
};
unload(() => manager.teardown());

Object.defineProperties(exports, {
  add: {value: (topic, cb) => manager.add(topic, cb)},
  remove: {value: (topic, cb) => manager.remove(topic, cb)}
});

/* vim: set et ts=2 sw=2 : */
