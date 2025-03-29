#!/bin/bash

# Simple conversion script that doesn't require npm run syntax
# Usage: ./convert.sh input.md output.docx

if [ $# -ne 2 ]; then
  echo "Usage: $0 input.md output.docx"
  exit 1
fi

INPUT="$1"
OUTPUT="$2"

echo "Converting $INPUT to $OUTPUT"
pandoc --filter ./mermaid-filter.js -f markdown -t docx -o "$OUTPUT" "$INPUT"
