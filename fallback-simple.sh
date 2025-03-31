#!/bin/bash

# Fallback script that skips mermaid diagrams completely and just processes the markdown content

set -e  # Exit on error
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/mermaid-conversion.log"

# Function for logging
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Check if we have the required arguments
if [ "$#" -ne 2 ]; then
    log "Usage: $0 input.md output.docx"
    exit 1
fi

INPUT_FILE="$1"
OUTPUT_FILE="$2"

# Ensure input file exists
if [ ! -f "$INPUT_FILE" ]; then
    log "Error: Input file '$INPUT_FILE' not found"
    exit 1
fi

log "Fallback conversion: $INPUT_FILE to $OUTPUT_FILE (without mermaid diagrams)"

# Create temp directory if it doesn't exist
TEMP_DIR="${SCRIPT_DIR}/temp"
mkdir -p "$TEMP_DIR"

# Create a simplified version of the input file without mermaid diagrams
SIMPLIFIED_MD="${TEMP_DIR}/simplified.md"
log "Creating simplified markdown file without mermaid diagrams..."

# Process the file line by line
mermaid_block=false
cat "$INPUT_FILE" | while IFS= read -r line; do
    # Check for mermaid block start/end
    if [[ "$line" == *'```mermaid'* || "$line" == *'~~~mermaid'* ]]; then
        mermaid_block=true
        # Add a placeholder for the diagram
        echo "**[Diagram placeholder - see original markdown]**" >> "$SIMPLIFIED_MD"
        continue
    fi
    
    if $mermaid_block; then
        if [[ "$line" == '```' || "$line" == '~~~' ]]; then
            mermaid_block=false
        fi
        continue
    fi
    
    # If we're not in a mermaid block, copy the line
    echo "$line" >> "$SIMPLIFIED_MD"
done

# Do a simple pandoc conversion without any filters
log "Converting simplified markdown to DOCX..."
pandoc "$SIMPLIFIED_MD" \
    --standalone \
    --from markdown \
    --to docx \
    -o "$OUTPUT_FILE" || {
    log "Error during conversion. Trying with minimal options..."
    pandoc "$SIMPLIFIED_MD" -o "$OUTPUT_FILE"
}

if [ -f "$OUTPUT_FILE" ] && [ -s "$OUTPUT_FILE" ]; then
    log "Fallback conversion complete. Note: Mermaid diagrams are represented as placeholders."
else
    log "Fallback conversion failed to produce output."
    exit 1
fi
