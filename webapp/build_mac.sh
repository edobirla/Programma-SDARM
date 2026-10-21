#!/bin/bash
# Crea "Programma SDARM.app" (versione 2) e lo zip per gli aggiornamenti.
# Uso:  bash webapp/build_mac.sh      → risultati in dist/
# La build gira in una cartella temporanea fuori da iCloud (vedi
# packaging/build_mac.sh: iCloud rovina la firma).
set -e
cd "$(dirname "$0")/.."
python3 -m pip install -q -r webapp/requirements.txt pyinstaller
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
python3 -m PyInstaller webapp/sdarm.spec --noconfirm --distpath "$TMP/dist" --workpath "$TMP/build"
APP="$TMP/dist/Programma SDARM.app"
xattr -cr "$APP" 2>/dev/null || true
codesign -s - --force --deep "$APP"          # firma ad-hoc: senza, sui Mac M non parte
codesign -v "$APP"
VER=$(python3 -c "import re;print(re.search(r'VERSION = \"([^\"]+)\"',open('webapp/server.py').read()).group(1))")
( cd "$TMP/dist" && ditto -c -k --keepParent "Programma SDARM.app" "$TMP/Programma-SDARM-$VER-mac.zip" )
mkdir -p dist
rm -rf "dist/Programma SDARM.app"
cp -R "$APP" dist/
cp "$TMP/Programma-SDARM-$VER-mac.zip" dist/
echo "Fatto: dist/Programma SDARM.app  e  dist/Programma-SDARM-$VER-mac.zip"
