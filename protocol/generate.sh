#!/usr/bin/env bash

set -euo pipefail

protocol_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd -- "$protocol_dir/.." && pwd)"
typescript_output="$project_dir/frontend/src/generated"
cpp_output="$project_dir/lib/protocol"
expected_flatc_version="flatc version 2.0.8"
temporary_output="$(mktemp -d)"

trap 'rm -rf "$temporary_output"' EXIT

if ! command -v flatc >/dev/null 2>&1; then
    echo "flatc is required to generate protocol bindings" >&2
    exit 1
fi

if [[ "$(flatc --version)" != "$expected_flatc_version" ]]; then
    echo "$expected_flatc_version is required to generate protocol bindings" >&2
    exit 1
fi

mkdir -p "$temporary_output/typescript" "$temporary_output/cpp"

flatc --ts -o "$temporary_output/typescript" "$protocol_dir/pumpkin.fbs"
flatc --cpp -o "$temporary_output/cpp" "$protocol_dir/pumpkin.fbs"

rm -rf "$typescript_output" "$cpp_output"
mv "$temporary_output/typescript" "$typescript_output"
mv "$temporary_output/cpp" "$cpp_output"
