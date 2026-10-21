#!/bin/bash
# Pubblica su Firebase la pagina del telefono e le regole del database.
# Prima volta:  npx -y firebase-tools login      (accesso con l'account Google della chiesa)
# Poi, a ogni modifica del pannello:  bash webapp/firebase/deploy.sh
set -e
cd "$(dirname "$0")"
rm -rf public && mkdir -p public/static public/assets
cp ../static/index.html public/index.html
cp ../static/output.html public/output.html
cp ../static/*.js ../static/*.css public/static/
cp ../../assets/logo-bianco.png ../../assets/app_icon.png ../../assets/apple-touch-icon.png public/assets/
npx -y firebase-tools deploy --only hosting,database
rm -rf public
