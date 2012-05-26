/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const {
  classes: Cc,
  interfaces: Ci,
  utils: Cu,
  results: Cr,
  Constructor, ctor
} = Components;

const {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

const ChromeRegistry = Cc["@mozilla.org/chrome/chrome-registry;1"].getService(Ci.nsIChromeRegistry);
const MemoryReporterManager = Cc["@mozilla.org/memory-reporter-manager;1"].getService(Ci.nsIMemoryReporterManager);
const ResProtoHandler = Services.io.getProtocolHandler("resource").QueryInterface(Ci.nsIResProtocolHandler);
const MainThread = Services.tm.mainThread;

function runSoon(f) MainThread.dispatch(f, 0);
function minimizeMemory(callback) {
  function notify(i) {
    Services.obs.notifyObservers(null, "memory-pressure", "heap-minimize");
    if (--i) {
      runSoon(notify.bind(null, i));
    }
    else if (callback) {
      runSoon(callback);
    }
  }
  notify(3);
}

function formatBytes(b) {
  if (b < 900) return b.toFixed(0) + " bytes";
  b /= 1024;
  if (b < 900) return b.toFixed(1) + " KB";
  b /= 1024;
  if (b < 900) return b.toFixed(2) + " MB";
  b /= 1024;
  return b.toFixed(3) + " GB";
}

function sortResults(a, b) {
  // size descending
  let rv = b.bytes - a.bytes;
  if (!rv) {
    // else name ascending
    rv = a.name < b.name ? -1 : 1;
  }
  return rv;
}

const resolveAboutURI = (function() {
  let resolved = new Map();
  return function resolveAboutURI(uri) {
    let mod = uri.path.replace(/#\?.*$/i, "");
    let rv = resolved.get(mod);
    if (!rv) {
      let c = Services.io.newChannelFromURI(uri);
      rv = c.URI.clone();
      if (rv.equals(uri)) {
        throw new Error("cannot resolve about URI");
      }
      resolved.set(mod, rv);
    }
    return rv;
  };
})();

function resolveURI(uri) {
  switch (uri.scheme) {
  case "jar":
  case "file":
    if (uri instanceof Ci.nsIJARURI) {
      return resolveURI(uri.JARFile);
    }
    return uri;
  case "chrome":
    return resolveURI(ChromeRegistry.convertChromeURL(uri));
  case "resource":
    return resolveURI(Services.io.newURI(ResProtoHandler.resolveURI(uri), null, null));
  case "about":
    if (uri.spec == "about:blank") {
      // hack: also map about:blank... to the app
      return resolveURI(resolveAboutURI(Services.io.newURI("about:memory", null, null)));
    }
    return resolveURI(resolveAboutURI(uri));
  default:
    throw new Error("cannot handle");
  }
}

function $(id) document.getElementById(id);
function $e(tag, attrs, text) {
  let e = document.createElement(tag);
  if (attrs) {
    for (let [k,v] in Iterator(attrs)) {
      e.setAttribute(k, v);
    }
  }
  if (text) {
    e.textContent = text;
  }
  return e;
}
function process(addons) {
  const known = [];
  const compartments = Object.create(null);;
  const re_map = /^explicit\/(?:js\/compartment\(\[System Principal\], (.+)\)|dom\/workers\(\)\/worker\((.+)?,|window-objects\/top\(((?:about|chrome):.*?),)/;
  let totalExplicit = 0;

  function handleReport(process, path, kind, units, amount, description) {
    if (path == "explicit") {
      totalExplicit = amount;
      return;
    }
    let spec = path.match(re_map);
    if (!spec) {
      return;
    }
    try {
      for (let i = spec.length; --i;) {
        if (spec[i]) {
          spec = spec[i].replace(/\\/g, "/").trim();
          break;
        }
      }
      
      if (spec in compartments) {
        compartments[spec] += amount;
      }
      else {
        compartments[spec] = amount;
      }
    }
    catch (ex) {
      console.error(spec.toSource(), ex);
    }
  }
  function mapSpecToAddon(spec, bytes) {
      for (let [,k] in Iterator(known)) {
          if (spec.lastIndexOf(k.spec, 0) == 0) {
              k.bytes += bytes;
              return true;
          }
      }
      return false;
  }
  function createBar(tr, type, bytes, total, maxb) {
  }

  try {
    // process addons
    for (let [,a] in Iterator(addons)) {
      if (!a.isActive) {
        continue;
      }
      try {
        let base = resolveURI(a.getResourceURI(".").cloneIgnoringRef());
        let notes;
        if (a.id == "about-addons-memory@tn123.org") {
          notes = ["This add-on. Yep, it uses memory too :p"];
        }
        known.push({
          addon: a,
          base: base,
          spec: base.spec,
          bytes: 0,
          footnotes: notes
          });
      }
      catch (ex) {
        console.warn("addon not supported", a.id);
      }
    }
    // Forcefeed the "Application" add-on
    {
      let appuri = resolveURI(Services.io.newURI("chrome://global/content/", null, null));
      if (!/omni.ja/.test(appuri.spec)) {
        appuri.path = appuri.path.replace("chrome/toolkit/content/global/global.xul", "");
      }
      let addon = {
        name: "Application",
        id: Services.appinfo.ID,
        creator: "Mozilla",
        iconURL: "chrome://branding/content/icon64.png"
        };
      try {
        let branding = Services.strings.createBundle("chrome://branding/locale/brand.properties");
        addon.name = branding.GetStringFromName("brandFullName");
        addon.creator = branding.GetStringFromName("vendorShortName");
      }
      catch (ex) {
        console.error("failed to get branding", ex);
      }
      known.push({
        addon: addon,
        base: appuri,
        spec: appuri.spec,
        bytes: 0,
        footnotes: ["This only includes frontend code that has locations tagged, just like any other add-on"]
        });
    }

    if ("collectAllReports" in MemoryReporterManager) {
      // experimental patch support :p
      let reports = MemoryReporterManager.collectAllReports();
      for (let i = reports.length; ~--i;) {
        const {process, path, kind, units, amount} = reports[i];
        handleReport(null, path, kind, units, amount);
      }
    }
    else {
      // process reports
      let e = MemoryReporterManager.enumerateReporters();
      while (e.hasMoreElements()) {
        let r = e.getNext();
        if (r instanceof Ci.nsIMemoryReporter) {
          handleReport(null, r.path, r.kind, r.units, r.amount);
        }
      }
      e = MemoryReporterManager.enumerateMultiReporters();
      while (e.hasMoreElements()) {
        let r = e.getNext();
        if (r instanceof Ci.nsIMemoryMultiReporter) {
          r.collectReports(handleReport, null);
        }
      }
    }

    // map reports to addons
    for (let [c, b] in Iterator(compartments)) {
      try {
        let spec = resolveURI(Services.io.newURI(c, null, null)).spec;
        if (!mapSpecToAddon(spec, b)) {
          throw new Error("not an addon uri:" + spec);
        }
      }
      catch (ex) {
        console.warn("failed to map", c, ex);
      }
    }

    // construct table
    known.sort(sortResults);
    let maxAddonBytes = 0;
    let totalAddons = known.reduce(function(p, e) {
      maxAddonBytes = Math.max(maxAddonBytes, e.bytes);
      return e.bytes + p;
    }, 0);

    let fragment = document.createDocumentFragment();
    let noteid = 0;
    for (let [,k] in Iterator(known)) {
      let tr = $e("tr");
      let tdn = $e("td");

      let icon = k.addon.icon64URL || k.addon.iconURL || "chrome://mozapps/skin/extensions/extensionGeneric.png";
      icon = $e("img", {"src": icon});
      let iconBox = $e("div", {"class": "icon"});
      let figure = $e("figure", {"class": "icon"});
      iconBox.appendChild(icon);
      figure.appendChild(iconBox);
      tdn.appendChild(figure);

      let footnotes;
      if (k.footnotes) {
        footnotes = document.createDocumentFragment();
        for (let [,note] in Iterator(k.footnotes)) {
          let id = ++noteid;
          let fn = $e("sup");
          // hack: need to construct the absolute uri ourselves in about:
          fn.appendChild($e("a", {"href": "about:addons-memory#fn_" + id}, id.toFixed(0))); 
          footnotes.appendChild(fn);
          let text = $e("p", {"class": "fn", "id": "fn_" + id}, note);
          let anc = $e("sup", null, "[" + id + "] ");
          text.insertBefore(anc, text.firstChild);
          document.body.appendChild(text);
        }
      }

      let pname = $e("p", {"class": "name"});
      if (k.addon.homepageURL) {
        pname.appendChild($e("a", {"target":"_blank", "href": k.addon.homepageURL}, k.addon.name));
      }
      else {
        pname.textContent = k.addon.name;
      }
      if (footnotes) {
        console.log(footnotes);
        pname.appendChild(footnotes);
      }
      tdn.appendChild(pname);

      tdn.appendChild($e("p", {"class": "creator"}, "by " + k.addon.creator));
      tdn.appendChild($e("p", {"class": "id"}, k.addon.id));
      tr.appendChild(tdn);
      tr.appendChild($e("td", {"data-value": k.bytes}, formatBytes(k.bytes)));

      let pa = k.bytes / totalAddons;
      let spa = (pa * 100.0).toFixed(1) + "%";
      let pe = k.bytes / totalExplicit;
      let spe = (pe * 100.0).toFixed(1) + "%";
      let scale = (k.bytes / maxAddonBytes * 100.0).toFixed(1) + "%";

      tr.appendChild($e("td", {"data-value": pa}, spa));
      tr.appendChild($e("td", {"data-value": pe}, spe));
      let progress = $e("div", {"class": "bar"});
      progress.style.width = scale;
      let tdp = $e("td");
      tdp.appendChild(progress);
      tr.appendChild(tdp);
      fragment.appendChild(tr);
    }
    let tr = $e("tr", {"class": "total"});
    tr.appendChild($e("td", null, "Total"));
    tr.appendChild($e("td", null, formatBytes(totalAddons)));
    tr.appendChild($e("td", null, "100%"));
    tr.appendChild($e("td", null, (totalAddons / totalExplicit * 100.0).toFixed(1) + "%"));
    fragment.appendChild(tr);

    $("tbody").appendChild(fragment);

    let (l = $("loading")) {
      l.parentNode.removeChild(l);
    }
  }
  catch (ex) {
    console.error(ex);
  }
}

addEventListener("load", function load() {
  removeEventListener("load", load, false);
  minimizeMemory(function() Cu.import("resource://gre/modules/AddonManager.jsm", {}).AddonManager.getAllAddons(process));
}, false);

/* vim: set et ts=2 sw=2 : */
