#!/bin/sh
set -eu

case "${PROCESS_ROLE:-api}" in
  api) exec node dist/main.api.js ;;
  worker) exec node dist/main.worker.js ;;
  *)
    echo "PROCESS_ROLE inválido: ${PROCESS_ROLE}. Use api ou worker." >&2
    exit 1
    ;;
esac
