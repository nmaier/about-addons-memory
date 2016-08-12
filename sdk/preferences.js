/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

/* This implementation was heavily inspired by the add-on SDK stuff ;)
 *
 * TODO:
 * - Implement enumerate/getChildren
 */

try {
  Instances.register("SupportsString", "@mozilla.org/supports-string;1", "nsISupportsString");
}
catch (ex) {
  // ignore
}

const {
  PREF_INVALID: INVALID,
  PREF_STRING: STR,
  PREF_INT: INT,
  PREF_BOOL: BOOL
} = Ci.nsIPrefBranch;

function createProxy(branch) {
  return new Proxy(branch, {
    get: function(receiver, name) {
      if (name in branch) {
        log(LOG_DEBUG, "prefproxy: returning plain " + name);
        return branch[name];
      }
      log(LOG_DEBUG, "prefproxy: returning pref " + branch.branch + name);
      return branch.get(name);
    },
    set: function(receiver, name, value) {
      if (name in branch) {
        throw new Error("Cannot use this name as a preference");
      }
      log(LOG_DEBUG, "prefproxy: setting pref " + branch.branch +  name);
      branch.set(name, value);
    },
    delete: function(name) {
      if (name in branch) {
        throw new Error("Cannot use this name as a preference");
      }
      branch.delete(name);
    },
    has: function(name) {
      if (name in branch) {
        throw new Error("Cannot use this name as a preference");
      }
      log(LOG_DEBUG, "prefproxy: has pref " + branch.branch +  name);
      return branch.has(name);
   }
  });
}

function Branch(branch) {
  if (typeof(branch) == "string") {
    if (!/\.$|^$/.test(branch)) {
      branch += ".";
    }
    branch = Services.prefs.getBranch(branch);
    if ("nsIPrefBranch2" in Ci) {
      branch.QueryInterface(Ci.nsIPrefBranch2);
    }
  }
  this.branch = branch.root;

  let getType = this.getType = pref => branch.getPrefType(pref);
  this.has = pref => getType(pref) != INVALID;
  this.isChanged = pref => branch.prefHasUserValue(pref);
  this.isDefault = pref => !this[pref].isChanged();
  let get = this.get = function(pref, defaultValue) {
    switch (getType(pref)) {
      case STR:
        return branch.getComplexValue(pref, Ci.nsISupportsString).data;
      case INT:
        return branch.getIntPref(pref);
      case BOOL:
        return branch.getBoolPref(pref);
      default:
        if (typeof(defaultValue) != "undefined") {
          return defaultValue;
        }
        log(LOG_DEBUG, "creating subbranch for " + branch.root + pref);
        return createProxy(new Branch(branch.root + pref));
    }
  };
  this.set = function(pref, value) {
    if (value === null || value === undefined) {
      log(LOG_DEBUG, "ignoring null value for pref " + pref);
      return;
    }
    switch (value.constructor.name) {
      case "Number":
        if (!isFinite(value)) {
          let msg = "attempt to set an invalid number to pref " + branch.root +
            pref + ": " + value;
          log(LOG_DEBUG, msg);
          throw new Error(msg);
        }
        if (value % 1) {
          log(LOG_DEBUG, "coercing float to int before setting pref " +
              branch.root + pref + ": " + value);
          value = parseInt(value);
        }
        branch.setIntPref(pref, value);
        break;

      case "Boolean":
        branch.setBoolPref(pref, value);
        break;

      default:
        log(LOG_DEBUG, "coercing object into string before setting pref " +
            branch.root + pref);
        value = value.toString();
        // fall through

      case "String":
        {
          let str = new Instances.SupportsString();
          str.data = value;
          branch.setComplexValue(pref, Ci.nsISupportsString, str);
        }
        break;
    }
  };
  this.delete = function(pref) {
    branch.clearUserPref(pref);
  };
  this.observe = function(pref, callback, defaultValue) {
    let obs = {
      observe: function(s, t, d) {
        [s, t, d] = [s, t, d];
        callback(pref, get(pref, defaultValue));
       }
    };
    branch.addObserver(pref, obs, false);
    unload(() => branch.removeObserver(pref, obs));
    obs.observe();
  };
}

(function setDefaultPrefs() {
  let branch = new Branch(Services.prefs.getDefaultBranch(""));
  let scope = {
    pref: (key, val) => {
      try {
        branch.set(key, val);
      }
      catch (ex) {
        Cu.reportError(ex);
      }
    }
  };
  try {
    Services.scriptloader.loadSubScript(BASE_PATH +
                                        "defaults/preferences/prefs.js", scope);
  }
  // errors here should not kill addon
  catch (ex) {
    log(LOG_ERROR, "failed to setup default preferences", ex);
  }
})();

var globalPrefs = createProxy(new Branch(""));
var prefs = globalPrefs.extensions[ADDON.id];

Object.defineProperties(exports, {
  prefs: {get: () => prefs, enumerable: true},
  globalPrefs: {value: globalPrefs, enumerable: true}
});

/* vim: set et ts=2 sw=2 : */
