#!/bin/bash

# Ultra-simple conversion script with debug output
# Usage: ./convert-simple.sh input.md output.docx

if [ $# -ne 2 ]; then
  echo "Usage: $0 input.md output.docx"
  exit 1
fi

INPUT="$1"
OUTPUT="$2"

# Check if input file exists
if [ ! -f "$INPUT" ]; then
  echo "Error: Input file '$INPUT' does not exist"
  exit 1
fi

# Ensure output directory exists
OUTPUT_DIR=$(dirname "$OUTPUT")
if [ ! -d "$OUTPUT_DIR" ] && [ "$OUTPUT_DIR" != "." ]; then
  echo "Creating output directory: $OUTPUT_DIR"
  mkdir -p "$OUTPUT_DIR" || { echo "Failed to create output directory"; exit 1; }
fi

# Get absolute paths for better diagnostics
ABS_INPUT=$(readlink -f "$INPUT")
ABS_OUTPUT=$(readlink -f "$OUTPUT_DIR")/$(basename "$OUTPUT")

echo "Converting $ABS_INPUT to $ABS_OUTPUT"

# Check for required tools
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is required but not installed"
  exit 1
fi

# Check required JavaScript files
for JSFILE in "./mermaid-filter.js" "./render-mermaid.js"; do
  if [ ! -f "$JSFILE" ]; then
    echo "Error: $JSFILE not found in current directory"
    exit 1
  fi
  if [ ! -x "$JSFILE" ]; then
    echo "Setting execute permissions for $JSFILE"
    chmod +x "$JSFILE"
  fi
done

# Check for required npm packages with improved error handling
echo "Checking npm packages..."
for PKG in "uuid" "sharp-cli" "svg-to-png"; do
  if ! npm list --depth=0 2>/dev/null | grep -q "$PKG"; then
    echo "Installing required npm package: $PKG"
    npm install --save "$PKG" || echo "Warning: Failed to install $PKG, will try alternatives"
  fi
done

# Also install globally for npx usage
echo "Ensuring svg-to-png is available for npx..."
if ! which svg-to-png &>/dev/null; then
  npm install -g svg-to-png || echo "Warning: Could not install svg-to-png globally, will use fallbacks"
fi

# Install sharp as a fallback for image conversion
if ! npm list --depth=0 2>/dev/null | grep -q "sharp"; then
  echo "Installing sharp as fallback for image conversion"
  npm install --save sharp
fi

# Create a simple fallback SVG conversion script
cat > ./temp/svg-convert.js << 'EOF'
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function convertSvgToPng(svgPath, pngPath) {
  try {
    // Read the SVG file
    const svgBuffer = fs.readFileSync(svgPath);
    
    // Convert to PNG using sharp
    await sharp(svgBuffer)
      .png()
      .toFile(pngPath);
    
    console.log(`Successfully converted ${svgPath} to ${pngPath}`);
    return true;
  } catch (error) {
    console.error(`Error converting SVG to PNG: ${error.message}`);
    return false;
  }
}

// Main function
async function main() {
  if (process.argv.length < 4) {
    console.error('Usage: node svg-convert.js <input-svg> <output-png>');
    process.exit(1);
  }
  
  const svgPath = process.argv[2];
  const pngPath = process.argv[3];
  
  try {
    const success = await convertSvgToPng(svgPath, pngPath);
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error(`Conversion failed: ${error.message}`);
    process.exit(1);
  }
}

main();
EOF

chmod +x ./temp/svg-convert.js

# Clean any old temp files
echo "Cleaning old temp files..."
rm -f ./temp/*.svg ./temp/*.png ./temp/*.mmd ./temp/*.html

# Create temp directory if it doesn't exist
mkdir -p ./temp

# Extract mermaid code blocks first to process them separately
echo "Extracting and pre-processing mermaid diagrams..."
grep -n "^\`\`\`mermaid" -A 100 "$INPUT" | awk '/^\`\`\`mermaid/,/^\`\`\`/' | grep -v "^\`\`\`" > ./temp/all_diagrams.mmd

# Count diagrams
DIAGRAM_COUNT=$(grep -c "^graph\|^flowchart\|^sequenceDiagram\|^classDiagram\|^stateDiagram\|^gantt\|^pie\|^erDiagram" ./temp/all_diagrams.mmd)
echo "Found $DIAGRAM_COUNT diagrams to pre-render"

# Increase timeout for conversion based on diagram count
TIMEOUT=$((120 + DIAGRAM_COUNT * 10))
echo "Setting conversion timeout to $TIMEOUT seconds"

# Try pandoc conversion with our filter
echo "Running conversion with mermaid filter (debug enabled)..."
export SVG_CONVERTER="./temp/svg-convert.js"
DEBUG=true timeout ${TIMEOUT}s pandoc \
  --filter ./mermaid-filter.js \
  -f markdown \
  -t docx \
  -o "$OUTPUT" \
  "$INPUT" \
  2>&1 | tee conversion.log

PANDOC_STATUS=${PIPESTATUS[0]}

if [ $PANDOC_STATUS -eq 124 ] || [ $PANDOC_STATUS -eq 137 ]; then
  echo "Error: Conversion timed out after $TIMEOUT seconds. Check conversion.log and ./temp/filter-debug.log for details."
  exit 1
fi

# Check if conversion was successful and if the output file was created
if [ $PANDOC_STATUS -eq 0 ]; then
  if [ -f "$OUTPUT" ]; then
    echo "Conversion completed successfully! Output file created at: $OUTPUT"
    ls -la "$OUTPUT"
  else
    echo "Error: Pandoc reported success but output file was not created."
    echo "Trying without the filter as fallback..."
    
    # Try without the filter as fallback
    pandoc -f markdown -t docx -o "$OUTPUT" "$INPUT"
    
    if [ -f "$OUTPUT" ]; then
      echo "Fallback conversion successful (without mermaid diagrams)."
    else
      echo "Fallback conversion also failed."
    fi
  fi
else
  echo "Conversion failed with exit code $PANDOC_STATUS. Check conversion.log for details."
fi

# Check for debug logs from the filter
if [ -f "./temp/filter-debug.log" ]; then
  echo "Filter debug log available at: ./temp/filter-debug.log"
  echo "Tail of debug log:"
  tail -n 20 ./temp/filter-debug.log
fi
