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

function _(id) {
  return document.body.getAttribute("data-" + id);
}

function runSoon(f) MainThread.dispatch(f, 0);
function minimizeMemoryUsage(callback) {
  function notify(i) {
    Services.obs.notifyObservers(null, "memory-pressure", "heap-minimize");
    if (--i) {
      runSoon(notify.bind(null, i));
    }
    else if (callback) {
      runSoon(callback);
    }
  }
  if ("minimizeMemoryUsage" in MemoryReporterManager) {
    MemoryReporterManager.minimizeMemoryUsage(callback);
  }
  else {
    notify(3);
  }
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
  var rv = b.bytes - a.bytes;
  if (!rv) {
    // else name ascending
    rv = a.name < b.name ? -1 : 1;
  }
  return rv;
}

const resolveAboutURI = (function() {
  let resolved = new Map();
  return function resolveAboutURI(uri) {
    var mod = uri.path.replace(/#\?.*$/i, "");
    var rv = resolved.get(mod);
    if (!rv) {
      var c = Services.io.newChannelFromURI2(uri, null, null, null, null, null, null);
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
  case "view-source":
    return resolveURI(Services.io.newURI(uri.path, null, null));
  default:
    throw new Error("cannot handle");
  }
}

function $(id) document.getElementById(id);
function $e(tag, attrs, text) {
  var e = document.createElement(tag);
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
  const re_jscompartment = /^explicit\/.*?(?:\/non-window-global|js-non-window)\/.*?\/compartment\((.*?)\)/;
  const re_windowobject = /^explicit\/(?:.*\/)?window-objects\/top\((.*?), id=\d+\)\/active\//;
  const re_worker = /^explicit\/(?:.*\/)?workers\/workers\(\)\/worker\((.*?), 0x[\da-f]+\)/;
  const re_explicit = /^explicit\//;
  const re_compartment = /^(\[System Principal\], )?(?:in.*?\?ownedBy=)?(.+?)(?: \(from: (.+?)(?::\d+)?)?$/;
  const re_schemes = /^(?:about|chrome|file|jar|resource)/;
  let rss = 0;

  function handleReport(process, path, kind, units, amount, description) {
    if (path == "resident") {
      rss = amount;
      return;
    }
    let m, spec;
    if (m = path.match(re_jscompartment)) {
      m = m[1].match(re_compartment);
      var syscomp = !!m[1];
      spec = m[2];
      if (m[3] && (!syscomp || !re_schemes.test(spec))) {
        spec = m[3].split(" -> ").pop();
      }
    }
    else if (m = path.match(re_windowobject)) {
      spec = m[1];
    }
    else if (m = path.match(re_worker)) {
      spec = m[1];
    }

    if (!spec) {
      return;
    }
    spec = spec.replace(/\\/g, "/").trim();
    try {
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
    if (/omni\.ja$|\.apk$/.test(spec)) {
      known[0].bytes += bytes;
      return true;
    }
    for (let [,k] in Iterator(known)) {
      if (spec.lastIndexOf(k.spec, 0) == 0) {
        k.bytes += bytes;
        return true;
      }
    }
    return false;
  }

  function process() {
    // map reports to addons
    for (var [c, b] in Iterator(compartments)) {
      try {
        var spec = resolveURI(Services.io.newURI(c, null, null)).spec;
        if (!mapSpecToAddon(spec, b)) {
          throw new Error("not an addon uri:" + spec);
        }
      }
      catch (ex) {
			if (!ex.name == "NS_ERROR_MALFORMED_URI") {
				console.warn("failed to map", c, ex);
			}
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
      if (!k.addon.isActive) {
        tr.className = "disabled";
      }
      let tdn = $e("td");

      let icon = k.addon.icon64URL || k.addon.iconURL || "chrome://about-addons-memory/content/extensionGeneric.png";
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
        pname.appendChild(footnotes);
      }
      tdn.appendChild(pname);

      tdn.appendChild($e("p", {"class": "creator"}, _("by") + " " + k.addon.creator));
      tdn.appendChild($e("p", {"class": "id"}, k.addon.id));
      tr.appendChild(tdn);
      tr.appendChild($e("td", {"data-value": k.bytes}, formatBytes(k.bytes)));

      let pa = k.bytes / totalAddons;
      let spa = (pa * 100.0).toFixed(1) + "%";
      let pe = k.bytes / rss;
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
    tr.appendChild($e("td", null, (totalAddons / rss * 100.0).toFixed(1) + "%"));
    fragment.appendChild(tr);

    $("tbody").appendChild(fragment);
    $("loading").parentNode.removeChild($("loading"));
  }

  try {
    // Forcefeed the "Application" add-on
    {
      let appuri = resolveURI(Services.io.newURI("about:config", null, null));
      let iconURL = "chrome://branding/content/icon64.png"
      try {
        if (!/omni\.ja|\.apk$/.test(appuri.spec)) {
          appuri.path = appuri.path.replace("chrome/toolkit/content/global/global.xul", "");
        }
      }
      catch (ex) {
        console.log("failed to get proper appuri; assuming omnijar");
      }
      if (/\.apk$/.test(appuri.spec)) {
        iconURL = "chrome://branding/content/favicon64.png"
      }
      let addon = {
        name: "Application",
        isActive: true,
        id: Services.appinfo.ID,
        creator: "Mozilla",
        iconURL: iconURL
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
        footnotes: [_("footnote-locations")]
        });
    }

    // process addons
    for (let [,a] in Iterator(addons)) {
      try {
        let base = resolveURI(a.getResourceURI(".").cloneIgnoringRef());
        let notes;
        if (/about-addons-memory@*/i.test(a.id)) {
          notes = [_("footnote-thisaddon")];
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

    // process reports
    if ("nsIMemoryMultiReporter" in Ci) {
      console.log("taking uni");
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
      process();
    }
    else if ("enumerateReporters" in MemoryReporterManager) {
      console.log("taking no-uni");
      let e = MemoryReporterManager.enumerateReporters();
      while (e.hasMoreElements()) {
        let r = e.getNext();
        if (r instanceof Ci.nsIMemoryReporter) {
          r.collectReports(handleReport, null);
        }
      }
      process();
    }
    else {
      console.log("taking getReports");
      if (MemoryReporterManager.getReports.length == 5) {
        MemoryReporterManager.getReports(handleReport, null, process, null, false);
      }
      else {
        MemoryReporterManager.getReports(handleReport, null, process, null);
      }
    }

  }
  catch (ex) {
    console.error(ex);
  }
}

addEventListener("load", function load() {
  removeEventListener("load", load, false);
  Cu.import("resource://gre/modules/AddonManager.jsm", {}).AddonManager.getAllAddons(process);
}, false);

/* vim: set et ts=2 sw=2 : */
