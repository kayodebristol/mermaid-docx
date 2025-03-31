#!/usr/bin/env node

/**
 * Mermaid diagram processor script for handling complex diagrams
 * This script processes markdown files and extracts/renders mermaid diagrams
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node process-mermaid.js <input-md-file> <output-md-file> [diagrams-dir]');
  process.exit(1);
}

const inputFile = args[0];
const outputFile = args[1];
const diagramsDir = args[2] || path.join(path.dirname(outputFile), 'img');

// Ensure directories exist
if (!fs.existsSync(diagramsDir)) {
  fs.mkdirSync(diagramsDir, { recursive: true });
}

// Find mmdc binary location
const scriptDir = path.dirname(require.main.filename);
let mmdcPath = path.join(scriptDir, 'node_modules', '.bin', 'mmdc');

if (!fs.existsSync(mmdcPath)) {
  mmdcPath = 'mmdc'; // Try using global install
}

console.log(`Processing ${inputFile} to ${outputFile} with diagrams in ${diagramsDir}`);

try {
  const content = fs.readFileSync(inputFile, 'utf8');
  const lines = content.split('\n');
  
  let processedContent = [];
  let inMermaidBlock = false;
  let diagramCounter = 0;
  let currentDiagramLines = [];
  let mermaidMarker = '```';  // Default marker

  // Process line by line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for mermaid block start
    if ((line.includes('```mermaid') || line.includes('~~~mermaid')) && !inMermaidBlock) {
      inMermaidBlock = true;
      diagramCounter++;
      mermaidMarker = line.includes('```') ? '```' : '~~~';
      currentDiagramLines = [];
      
      // Add placeholder instead of mermaid start tag
      processedContent.push(`![Diagram ${diagramCounter}](${path.join(diagramsDir, `d${diagramCounter}.png`).replace(/\\/g, '/')})`);
      continue;
    }
    
    // Check for mermaid block end
    if (inMermaidBlock && (line.trim() === mermaidMarker)) {
      inMermaidBlock = false;
      
      // Process this diagram
      const diagramFile = path.join(diagramsDir, `d${diagramCounter}.mmd`);
      const outputImageFile = path.join(diagramsDir, `d${diagramCounter}.png`);
      
      // Write diagram content to file
      fs.writeFileSync(diagramFile, currentDiagramLines.join('\n'));
      
      // Try to render it
      console.log(`Rendering diagram ${diagramCounter}...`);
      
      try {
        // First try with normal settings
        execSync(`${mmdcPath} -i "${diagramFile}" -o "${outputImageFile}" -b white`, {
          env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' },
          stdio: 'pipe',
          timeout: 10000 // 10 second timeout
        });
        console.log(`Successfully rendered diagram ${diagramCounter}`);
      } catch (error) {
        console.log(`Could not render diagram ${diagramCounter} - using placeholder instead`);
        // Replace the image reference with a text placeholder
        processedContent.pop(); // Remove the image reference
        processedContent.push(`**[Diagram ${diagramCounter} - Could not be rendered]**`);
      }
      
      continue; // Skip the closing marker line
    }
    
    if (inMermaidBlock) {
      // Collect diagram content
      currentDiagramLines.push(line);
    } else {
      // Pass through non-mermaid content
      processedContent.push(line);
    }
  }

  // Write the processed content to output file
  fs.writeFileSync(outputFile, processedContent.join('\n'));
  console.log('Processing complete');
  
} catch (error) {
  console.error('Error processing markdown file:');
  console.error(error.message);
  process.exit(1);
}
