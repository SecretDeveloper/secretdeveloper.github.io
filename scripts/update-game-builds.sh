#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
site_root="$(cd "${script_dir}/.." && pwd)"
games_dir="${site_root}/static/games"
checkout_root="$(mktemp -d "${TMPDIR:-/tmp}/secretdeveloper-games.XXXXXX")"
readonly script_dir site_root games_dir checkout_root

cleanup() {
  rm -rf "${checkout_root}"
}
trap cleanup EXIT

usage() {
  cat <<'EOF'
Usage: ./scripts/update-game-builds.sh [game ...]

Pull the latest committed dist/ build for each game into static/games/.
With no arguments, all external games are updated.

Games:
  siege
  sailing
  av8n
EOF
}

repository_for() {
  case "$1" in
    siege) printf '%s\n' 'https://github.com/SecretDeveloper/siege.git' ;;
    sailing) printf '%s\n' 'https://github.com/SecretDeveloper/sailing.git' ;;
    av8n) printf '%s\n' 'https://github.com/SecretDeveloper/Av8n.git' ;;
    *) return 1 ;;
  esac
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

if (( $# == 0 )); then
  games=(siege sailing av8n)
else
  games=("$@")
fi

mkdir -p "${games_dir}"

for game in "${games[@]}"; do
  if ! repository_url="$(repository_for "${game}")"; then
    printf 'Unknown game: %s\n\n' "${game}" >&2
    usage >&2
    exit 2
  fi

  checkout_dir="${checkout_root}/${game}"
  destination_dir="${games_dir}/${game}"

  printf 'Updating %s from %s\n' "${game}" "${repository_url}"
  git clone --quiet --depth 1 "${repository_url}" "${checkout_dir}"

  if [[ ! -f "${checkout_dir}/dist/index.html" ]]; then
    printf 'Expected %s to contain a committed dist/index.html\n' "${repository_url}" >&2
    exit 1
  fi

  if [[ -L "${destination_dir}" ]]; then
    printf 'Refusing to replace symlink destination: %s\n' "${destination_dir}" >&2
    exit 1
  fi

  mkdir -p "${destination_dir}"
  rsync -a --delete "${checkout_dir}/dist/" "${destination_dir}/"

  revision="$(git -C "${checkout_dir}" rev-parse --short HEAD)"
  printf 'Updated static/games/%s/ to %s\n' "${game}" "${revision}"
done
