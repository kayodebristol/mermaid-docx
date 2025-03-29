#!/usr/bin/env node

// This is a pandoc filter for converting mermaid code blocks to images
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { v4: uuidv4 } = require('uuid');

// Debug mode
const DEBUG = process.env.DEBUG === 'true';
const SVG_CONVERTER = process.env.SVG_CONVERTER || 'npx svg-to-png';
const tempDir = path.join(process.cwd(), 'temp');

// Ensure temp directory exists
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Set up debug logging
const logFile = path.join(tempDir, 'filter-debug.log');
function log(message) {
  if (DEBUG) {
    fs.appendFileSync(logFile, message + '\n');
  }
}

log(`Filter started: ${new Date().toISOString()}`);

// Function to convert SVG to PNG using multiple methods
function convertSvgToPng(svgPath, pngPath) {
  // First try specified converter 
  let result = spawnSync(SVG_CONVERTER, [svgPath, pngPath], {
    stdio: 'pipe',
    encoding: 'utf-8',
    shell: true
  });

  if (result.status === 0) {
    log(`Successfully converted SVG to PNG using ${SVG_CONVERTER}`);
    return true;
  }

  log(`${SVG_CONVERTER} failed: ${result.stderr || result.error}`);
  
  // Try fallback methods
  // Method 1: Use our custom node script if SVG_CONVERTER failed
  if (fs.existsSync('./temp/svg-convert.js')) {
    log('Trying fallback node-based converter');
    result = spawnSync('node', ['./temp/svg-convert.js', svgPath, pngPath], {
      stdio: 'pipe',
      encoding: 'utf-8'
    });
    
    if (result.status === 0) {
      log('Successfully converted SVG to PNG using node fallback');
      return true;
    }
    
    log(`Node fallback failed: ${result.stderr || result.error}`);
  }
  
  // Method 2: Try using ImageMagick if available
  result = spawnSync('which', ['convert'], { stdio: 'pipe', encoding: 'utf-8' });
  if (result.status === 0) {
    log('Trying ImageMagick convert');
    result = spawnSync('convert', [svgPath, pngPath], {
      stdio: 'pipe',
      encoding: 'utf-8'
    });
    
    if (result.status === 0) {
      log('Successfully converted SVG to PNG using ImageMagick');
      return true;
    }
    
    log(`ImageMagick failed: ${result.stderr || result.error}`);
  }

  // If all conversions fail, create a simple error PNG
  log('All SVG to PNG conversion methods failed, creating error image');
  try {
    // Create a simple error PNG using node-canvas if available or copy a default error image
    const errorPngPath = path.join(__dirname, 'error.png');
    if (fs.existsSync(errorPngPath)) {
      fs.copyFileSync(errorPngPath, pngPath);
      return true;
    }
    return false;
  } catch (error) {
    log(`Failed to create error image: ${error.message}`);
    return false;
  }
}

// Function to process a Mermaid code block
function processMermaidBlock(content) {
  try {
    // Generate unique filenames
    const id = uuidv4();
    const mmdFile = path.join(tempDir, `${id}.mmd`);
    const svgFile = path.join(tempDir, `${id}.svg`);
    const pngFile = path.join(tempDir, `${id}.png`);
    
    // Write the Mermaid content to a file
    log(`Writing mermaid code to ${mmdFile}`);
    fs.writeFileSync(mmdFile, content);
    
    // Render the Mermaid diagram to SVG
    log('Running render-mermaid.js');
    const renderResult = spawnSync('node', ['./render-mermaid.js', mmdFile, svgFile], {
      stdio: 'pipe',
      encoding: 'utf-8'
    });
    
    if (renderResult.status !== 0) {
      throw new Error(renderResult.stderr || renderResult.error || 'Unknown error rendering diagram');
    }
    
    // Convert the SVG to PNG
    if (!convertSvgToPng(svgFile, pngFile)) {
      throw new Error('Failed to convert SVG to PNG');
    }
    
    // Return the path to the PNG file
    return pngFile;
  } catch (error) {
    log(`Error in processMermaidBlock: ${error}`);
    throw error;
  }
}

// Process standard input
let input = '';
process.stdin.on('data', (chunk) => {
  input += chunk;
});

process.stdin.on('end', () => {
  try {
    log('Processing input JSON');
    const json = JSON.parse(input);
    
    // Process the document
    const newJson = processMermaidDiagrams(json);
    
    // Output the modified JSON
    log('Sending modified JSON');
    process.stdout.write(JSON.stringify(newJson));
    log('Filter completed successfully');
  } catch (error) {
    log(`Filter error: ${error.message}`);
    process.stderr.write(`Error: ${error.message}\n`);
    process.exit(1);
  }
});

// Function to process the document
function processMermaidDiagrams(json) {
  // Process the blocks
  const walk = (obj) => {
    if (Array.isArray(obj)) {
      return obj.map(walk);
    } else if (obj && typeof obj === 'object') {
      const newObj = {};
      for (const [key, value] of Object.entries(obj)) {
        newObj[key] = walk(value);
      }
      
      // Process a code block with mermaid class
      if (obj.t === 'CodeBlock' && obj.c && Array.isArray(obj.c) && obj.c[0] && 
          Array.isArray(obj.c[0][1]) && obj.c[0][1].includes('mermaid')) {
        try {
          const content = obj.c[1];
          log(`Found mermaid block: ${content.substring(0, 40)}...`);
          
          // Process the mermaid block
          const pngFile = processMermaidBlock(content);
          
          // Replace with an image
          return {
            t: 'Para',
            c: [{
              t: 'Image',
              c: [
                ['', [], []],
                [],
                [pngFile, '']
              ]
            }]
          };
        } catch (error) {
          log(`Error processing mermaid block: ${error}`);
          
          // Return a paragraph with error message instead of failing
          return {
            t: 'Para',
            c: [{
              t: 'Str',
              c: `[Error rendering diagram: ${error.message}]`
            }]
          };
        }
      }
      
      return newObj;
    }
    
    return obj;
  };
  
  return walk(json);
}

// Make sure we handle errors properly
process.stdin.on('error', (error) => {
  log('stdin error: ' + error.message);
  process.exit(1);
});

process.stdout.on('error', (error) => {
  log('stdout error: ' + error.message);
  process.exit(1);
});

