#!/usr/bin/env bash
# build-python-runtime.sh
#
# Downloads a relocatable CPython 3.11 (aarch64-apple-darwin) from
# python-build-standalone and installs mlx-lm into it.
#
# Output: resources/python-runtime/
#
# Run on a macOS arm64 machine (or arm64 GitHub Actions runner) before
# packaging the app with `npm run dist:mac`.
#
# Usage:
#   bash scripts/build-python-runtime.sh
#
# Requirements:
#   - macOS arm64
#   - curl, tar

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEST="$PROJECT_ROOT/resources/python-runtime"

# python-build-standalone release (update as needed)
PBS_VERSION="20241016"
PBS_ASSET="cpython-3.11.10+${PBS_VERSION}-aarch64-apple-darwin-install_only.tar.gz"
PBS_URL="https://github.com/indygreg/python-build-standalone/releases/download/${PBS_VERSION}/${PBS_ASSET}"

echo "==> Building Python runtime for Apple Silicon MLX backend"
echo "    Destination: $DEST"

if [[ "$(uname -m)" != "arm64" ]]; then
  echo "ERROR: This script must run on an arm64 Mac."
  exit 1
fi

# Clean previous build
rm -rf "$DEST"
mkdir -p "$DEST"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "==> Downloading $PBS_ASSET …"
curl -L --progress-bar -o "$TMP_DIR/$PBS_ASSET" "$PBS_URL"

echo "==> Extracting …"
tar -xzf "$TMP_DIR/$PBS_ASSET" -C "$TMP_DIR"

# The archive extracts to a `python/` directory
cp -r "$TMP_DIR/python/." "$DEST/"

PYTHON="$DEST/bin/python3.11"
PIP="$DEST/bin/pip3.11"

# Ensure pip is available
"$PYTHON" -m ensurepip --upgrade 2>/dev/null || true
"$PYTHON" -m pip install --upgrade pip --quiet

echo "==> Installing mlx-lm …"
"$PYTHON" -m pip install mlx-lm --quiet

echo "==> Stripping .pyc cache and test directories …"
find "$DEST" -name "*.pyc" -delete
find "$DEST" -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
find "$DEST" -type d -name "test" -exec rm -rf {} + 2>/dev/null || true
find "$DEST" -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true

echo "==> Done. Runtime size:"
du -sh "$DEST"
echo ""
echo "    $DEST is ready. Commit or cache it before running npm run dist:mac."
