#!/bin/bash

# Simplified Mermaid-Docx Conversion Script
# Uses local installations for all npm packages

set -e  # Exit on error
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/mermaid-conversion.log"
ERROR_LOG="${SCRIPT_DIR}/mermaid-filter.err"
VERBOSE=false
COMPLEX_MODE=false

# Function for logging
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Function for verbose logging
verbose_log() {
    if [ "$VERBOSE" = true ]; then
        log "$1"
    fi
}

# Process command line options
while getopts ":vc" opt; do
  case $opt in
    v)
      VERBOSE=true
      ;;
    c)
      COMPLEX_MODE=true
      log "Complex mode enabled (for large/problematic documents)"
      ;;
    \?)
      log "Invalid option: -$OPTARG"
      exit 1
      ;;
  esac
done
shift $((OPTIND-1))

# Check if we have the required arguments
if [ "$#" -ne 2 ]; then
    log "Usage: $0 [-v] [-c] input.md output.docx"
    log "Options:"
    log "  -v  Verbose mode (more detailed logs)"
    log "  -c  Complex mode (for large documents with many diagrams)"
    exit 1
fi

INPUT_FILE="$1"
OUTPUT_FILE="$2"

# Ensure input file exists
if [ ! -f "$INPUT_FILE" ]; then
    log "Error: Input file '$INPUT_FILE' not found"
    exit 1
fi

log "Converting $INPUT_FILE to $OUTPUT_FILE"

# Initialize project if needed
if [ ! -f "${SCRIPT_DIR}/package.json" ]; then
    log "Initializing npm project..."
    (cd "$SCRIPT_DIR" && npm init -y) >> "$LOG_FILE" 2>&1
fi

# Install required packages locally if they don't exist
if [ ! -d "${SCRIPT_DIR}/node_modules/mermaid-filter" ]; then
    log "Installing mermaid-filter locally..."
    (cd "$SCRIPT_DIR" && npm install --save-dev mermaid-filter) >> "$LOG_FILE" 2>&1
fi

if [ ! -d "${SCRIPT_DIR}/node_modules/svg-to-png" ]; then
    log "Installing svg-to-png locally..."
    (cd "$SCRIPT_DIR" && npm install --save-dev svg-to-png) >> "$LOG_FILE" 2>&1
fi

# Install mermaid itself which is required by mermaid-filter
if [ ! -d "${SCRIPT_DIR}/node_modules/mermaid" ]; then
    log "Installing mermaid package..."
    (cd "$SCRIPT_DIR" && npm install --save-dev mermaid) >> "$LOG_FILE" 2>&1
fi

# Create temp directory if it doesn't exist
TEMP_DIR="${SCRIPT_DIR}/temp"
mkdir -p "$TEMP_DIR"

# Clean old temp files
log "Cleaning old temp files..."
rm -f "$TEMP_DIR"/*.svg "$TEMP_DIR"/*.png

# Create mermaid-filter configuration file
log "Creating mermaid-filter configuration..."
cat > "${SCRIPT_DIR}/.mermaid-config.json" << EOF
{
  "puppeteerConfig": {
    "args": ["--no-sandbox", "--disable-setuid-sandbox"]
  },
  "outputFormat": "png",
  "outputDir": "${TEMP_DIR}",
  "caption": true
}
EOF

# Create a detailed debug log
DEBUG_LOG="${SCRIPT_DIR}/filter-debug.log"
log "Debug information will be written to $DEBUG_LOG"

# For complex files, use pre-processing approach with the Node.js helper
if [ "$COMPLEX_MODE" = true ]; then
    # Use the Node.js helper script for complex files
    log "Using complex mode with Node.js pre-processing..."
    DIAGRAMS_DIR="${TEMP_DIR}/img"
    mkdir -p "$DIAGRAMS_DIR"
    
    if [ ! -f "${SCRIPT_DIR}/process-mermaid.js" ]; then
        log "Error: Required helper script process-mermaid.js not found"
        exit 1
    fi
    
    # Process the file with the Node.js helper
    log "Pre-processing diagrams with Node.js helper..."
    PROCESSED_OUTPUT="${TEMP_DIR}/processed.md"
    node "${SCRIPT_DIR}/process-mermaid.js" "$INPUT_FILE" "$PROCESSED_OUTPUT" "$DIAGRAMS_DIR" > "$DEBUG_LOG" 2>&1 || {
        log "Error during diagram pre-processing. Check $DEBUG_LOG for details."
        exit 1
    }
    
    # Convert the processed file to DOCX
    log "Converting pre-processed markdown to DOCX..."
    pandoc "$PROCESSED_OUTPUT" --standalone --resource-path="$TEMP_DIR" -o "$OUTPUT_FILE" >> "$DEBUG_LOG" 2>&1 || {
        log "Error during pandoc conversion. Falling back to fallback script..."
        if [ -f "${SCRIPT_DIR}/fallback-simple.sh" ]; then
            bash "${SCRIPT_DIR}/fallback-simple.sh" "$INPUT_FILE" "$OUTPUT_FILE"
        else
            log "Fallback script not found. Conversion failed."
            exit 1
        fi
    }
else
    # For normal/simple files, use the original approach
    log "Running conversion with mermaid filter (standard mode)..."
    export NODE_PATH="${SCRIPT_DIR}/node_modules"
    export MERMAID_FILTER_FORMAT="png"
    export MERMAID_FILTER_OUTPUT_DIR="${TEMP_DIR}"
    
    # Run the conversion using local mermaid-filter
    if [ "$VERBOSE" = true ]; then
        # Verbose mode uses a two-step approach
        log "Processing in verbose mode with intermediate HTML..."
        TEMP_HTML="${TEMP_DIR}/temp-output.html"
        
        # Step 1: Convert markdown to HTML with mermaid diagrams
        pandoc "$INPUT_FILE" --filter "${SCRIPT_DIR}/node_modules/.bin/mermaid-filter" -o "$TEMP_HTML" 2> "$ERROR_LOG" || {
            log "Error in markdown to HTML conversion. Check $ERROR_LOG for details."
            exit 1
        }
        
        # Step 2: Convert HTML to DOCX
        pandoc "$TEMP_HTML" -o "$OUTPUT_FILE" 2>> "$ERROR_LOG" || {
            log "Error in HTML to DOCX conversion. Check $ERROR_LOG for details."
            exit 1
        }
    else
        # Standard mode - direct conversion
        pandoc "$INPUT_FILE" --standalone --filter "${SCRIPT_DIR}/node_modules/.bin/mermaid-filter" -o "$OUTPUT_FILE" 2> "$ERROR_LOG"
        
        # Check for errors
        if [ $? -ne 0 ]; then
            log "Error during conversion. Check $ERROR_LOG for details."
            exit 1
        fi
    fi
fi

# Verify the output file exists and has content
if [ ! -f "$OUTPUT_FILE" ]; then
    log "Error: Output file not created"
    exit 1
elif [ ! -s "$OUTPUT_FILE" ]; then
    log "Warning: Output file is empty"
else
    # Count diagrams in output directory
    DIAGRAM_COUNT=$(find "$TEMP_DIR" -name "*.png" | wc -l)
    log "Conversion completed successfully! Output file: $OUTPUT_FILE (with $DIAGRAM_COUNT diagrams)"
fi
