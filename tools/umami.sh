#!/bin/sh
# Refreshes vendor/umami.js, the copy of Umami's tracker the app serves itself (see Analytics in app.js).
# Read the diff before committing: this file runs on every visit to the live site.
cd "$(dirname "$0")/.." || exit 1
{ echo "// Umami's tracker (MIT licence, github.com/umami-software/umami), copied from https://cloud.umami.is/script.js on $(date +%F)."
  echo "// Served from this site so no outside script runs in the app; it only sends anonymous counts to Umami. Refresh: tools/umami.sh"
  curl -fsS https://cloud.umami.is/script.js; } > vendor/umami.js.new && mv vendor/umami.js.new vendor/umami.js && git diff --stat vendor/umami.js
