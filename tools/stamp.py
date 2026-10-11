#!/usr/bin/env python3
"""Give every script a version taken from its contents, so a browser never mixes old and new files.

GitHub Pages lets a browser keep each file for ten minutes, and after an update a page could load
the new js/i18n.js beside an old js/main.js. The deploy workflow runs this on the copy it publishes:
main.js is loaded as js/main.js?v=<hash>, and an import map sends every import of js/<name>.js to
js/<name>.js?v=<hash>, so a changed file always arrives under a new address. The page in the
repository is left as it is and still runs unstamped from a local server.

    python3 tools/stamp.py [site directory, default .]
"""
import hashlib
import json
import pathlib
import sys

site = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.')
index = site / 'index.html'
html = index.read_text(encoding='utf-8')

entry = '<script type="module" src="js/main.js"></script>'
if html.count(entry) != 1:
    raise SystemExit('index.html: expected exactly one ' + entry)

def version(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()[:10]

scripts = sorted((site / 'js').glob('*.js'))
imports = {f'./js/{p.name}': f'./js/{p.name}?v={version(p)}' for p in scripts}
importmap = json.dumps({'imports': imports}, indent=2)
stamped = (f'<script type="importmap">\n{importmap}\n</script>\n    '
           f'<script type="module" src="{imports["./js/main.js"]}"></script>')
index.write_text(html.replace(entry, stamped), encoding='utf-8')
print(f'stamped {len(scripts)} scripts')
