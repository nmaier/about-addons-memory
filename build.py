# vim: set nosmartindent et ts=4 sw=4 :

import os, sys, re
from glob import glob
from zipfile import ZipFile, ZIP_STORED, ZIP_DEFLATED

try:
    from xpisign.context import ZipFileMinorCompression as Minor
except ImportError:
    from warnings import warn
    warn("No optimal compression available; install xpisign")
    class Minor(object):
        def __enter__():
            pass
        def __exit__(*args):
            pass

resources = [
    "install.rdf",
    "chrome.manifest",
    "*.xhtml",
    "*.dtd", "*/*.dtd",
    "*.css",
    "*.gif",
    "about.js",
    "LICENSE"
    ]
destination = "about-addons-memory.xpi"

def get_js_requires(scripts):
    known = set()
    scripts = list(scripts)
    for script in scripts:
        with open(script) as sp:
            for line in sp:
                m = re.search(r"(?:r|lazyR)equire\((['\"])(.+?)\1", line)
                if not m:
                    continue
                m = m.group(2) + ".js"
                if m in known:
                    continue
                known.add(m)
                scripts += m,
    return set(scripts)

def get_files(resources):
    for r in get_js_requires(("bootstrap.js", "loader.jsm")):
        yield r
    for r in resources:
        if os.path.isfile(r):
            yield r
        else:
            for g in glob(r):
                yield g

if os.path.exists(destination):
    print >>sys.stderr, destination, "is in the way"
    sys.exit(1)

class ZipOutFile(ZipFile):
    def __init__(self, zfile):
        ZipFile.__init__(self, zfile, "w", ZIP_DEFLATED)
    def __enter__(self):
        return self
    def __exit__(self, type, value, traceback):
        self.close()

with Minor():
    with ZipOutFile(destination) as zp:
        for f in sorted(get_files(resources), key=str.lower):
            zp.write(f)
