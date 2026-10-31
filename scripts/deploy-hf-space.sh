#!/usr/bin/env bash
# Create or update a public Hugging Face Docker Space and upload a built tree.
# Usage:
#   HF_TOKEN=hf_... HF_SPACE=username/alphatape scripts/deploy-hf-space.sh
#   HF_TOKEN=hf_... HF_SPACE=username/alphatape scripts/deploy-hf-space.sh /path/to/space-tree
# With no directory, the script builds a fresh tree with scripts/build-hf-space.sh.
# Does not print JWT_SECRET.
set -euo pipefail

if [[ $# -gt 1 ]]; then
  echo "usage: HF_TOKEN=... HF_SPACE=username/alphatape scripts/deploy-hf-space.sh [space-dir]" >&2
  exit 2
fi

if [[ -z "${HF_TOKEN:-}" || -z "${HF_SPACE:-}" ]]; then
  echo "HF_TOKEN and HF_SPACE are required. HF_SPACE looks like username/alphatape." >&2
  exit 2
fi

if [[ ! "$HF_SPACE" =~ ^[^/[:space:]]+/[^/[:space:]]+$ ]]; then
  echo "HF_SPACE must look like username/alphatape" >&2
  exit 2
fi

root=$(cd "$(dirname "$0")/.." && pwd -P)
tmp=""
cleanup() {
  if [[ -n "$tmp" ]]; then
    rm -rf "$tmp"
  fi
}
trap cleanup EXIT

if [[ $# -eq 1 ]]; then
  if [[ ! -d "$1" ]]; then
    echo "space directory not found: $1" >&2
    exit 2
  fi
  tree=$(cd "$1" && pwd -P)
else
  tmp=$(mktemp -d)
  "$root/scripts/build-hf-space.sh" "$tmp"
  tree=$tmp
fi

if [[ ! -f "$tree/Dockerfile" || ! -f "$tree/README.md" ]]; then
  echo "space tree is missing Dockerfile or README.md: $tree" >&2
  exit 2
fi

if ! python3 -c "import huggingface_hub" >/dev/null 2>&1; then
  python3 -m pip install --user "huggingface_hub"
fi

export HF_TREE="$tree"
python3 - <<'PY'
import os
import secrets

from huggingface_hub import HfApi

space = os.environ["HF_SPACE"]
tree = os.environ["HF_TREE"]
api = HfApi(token=os.environ["HF_TOKEN"])
api.create_repo(
    repo_id=space,
    repo_type="space",
    space_sdk="docker",
    private=False,
    exist_ok=True,
    space_hardware="cpu-basic",
)
api.upload_folder(
    folder_path=tree,
    repo_id=space,
    repo_type="space",
    commit_message="Deploy AlphaTape Docker Space",
)
api.add_space_secret(repo_id=space, key="JWT_SECRET", value=secrets.token_urlsafe(32))
api.request_space_hardware(repo_id=space, hardware="cpu-basic")
print(f"uploaded {tree} to https://huggingface.co/spaces/{space}")
print("set Space secret JWT_SECRET (value not printed) and requested cpu-basic")
PY
