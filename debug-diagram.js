#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Check for required arguments
if (process.argv.length < 3) {
  console.error('Usage: node debug-diagram.js <diagram-file>');
  process.exit(1);
}

// Get the diagram file path
const diagramFile = process.argv[2];

try {
  // Read the diagram file
  const diagramContent = fs.readFileSync(diagramFile, 'utf8');
  
  // Extract Mermaid code blocks - try multiple patterns
  // Pattern 1: Standard markdown ```mermaid blocks
  const mermaidRegex1 = /```mermaid\n([\s\S]*?)\n```/g;
  // Pattern 2: Indented code blocks with mermaid class
  const mermaidRegex2 = /```\s*{\.mermaid}\n([\s\S]*?)\n```/g;
  // Pattern 3: Alternative syntax
  const mermaidRegex3 = /~~~mermaid\n([\s\S]*?)\n~~~/g;
  // Pattern 4: Code blocks with .mermaid class
  const mermaidRegex4 = /```\s*\.mermaid\n([\s\S]*?)\n```/g;
  // Pattern 5: Code blocks with explicit mermaid language
  const mermaidRegex5 = /```\s*mermaid\n([\s\S]*?)\n```/g;
  
  let match;
  let index = 0;
  
  console.log(`Looking for Mermaid diagrams in ${diagramFile}:`);
  
  // Try all patterns
  const patterns = [
    { regex: mermaidRegex1, name: "```mermaid" },
    { regex: mermaidRegex2, name: "```{.mermaid}" },
    { regex: mermaidRegex3, name: "~~~mermaid" },
    { regex: mermaidRegex4, name: "```.mermaid" },
    { regex: mermaidRegex5, name: "```mermaid (alt)" }
  ];
  
  for (const pattern of patterns) {
    console.log(`Trying pattern: ${pattern.name}`);
    while ((match = pattern.regex.exec(diagramContent)) !== null) {
      index++;
      const code = match[1].trim();
      
      // Save each diagram to a separate file for debugging
      const outputFile = path.join(
        path.dirname(diagramFile),
        `diagram-${index}-${path.basename(diagramFile, path.extname(diagramFile))}.mmd`
      );
      
      fs.writeFileSync(outputFile, code);
      
      console.log(`Diagram #${index} saved to ${outputFile}`);
      console.log(`Pattern: ${pattern.name}`);
      console.log(`Diagram content (first 100 chars): ${code.substring(0, 100)}...`);
      console.log('---');
    }
  }
  
  // As a last resort, look for any diagram-like content
  if (index === 0) {
    console.log("No standard Mermaid blocks found. Checking for raw diagram content...");
    
    // Look for common Mermaid syntax patterns
    const rawPatterns = [
      /graph\s+[A-Za-z][A-Za-z]?\s*\n([\s\S]*?)(?:\n\n|\n```|$)/g,
      /flowchart\s+[A-Za-z][A-Za-z]?\s*\n([\s\S]*?)(?:\n\n|\n```|$)/g,
      /sequenceDiagram\s*\n([\s\S]*?)(?:\n\n|\n```|$)/g,
      /classDiagram\s*\n([\s\S]*?)(?:\n\n|\n```|$)/g,
      /erDiagram\s*\n([\s\S]*?)(?:\n\n|\n```|$)/g,
      /gantt\s*\n([\s\S]*?)(?:\n\n|\n```|$)/g,
      /pie\s*\n([\s\S]*?)(?:\n\n|\n```|$)/g
    ];
    
    for (const rawRegex of rawPatterns) {
      while ((match = rawRegex.exec(diagramContent)) !== null) {
        index++;
        // Get the full match which includes the diagram type
        const fullMatch = match[0];
        
        // Save each diagram to a separate file for debugging
        const outputFile = path.join(
          path.dirname(diagramFile),
          `raw-diagram-${index}-${path.basename(diagramFile, path.extname(diagramFile))}.mmd`
        );
        
        fs.writeFileSync(outputFile, fullMatch);
        
        console.log(`Raw diagram #${index} saved to ${outputFile}`);
        console.log(`Diagram content (first 100 chars): ${fullMatch.substring(0, 100)}...`);
        console.log('---');
      }
    }
  }
  
  if (index === 0) {
    console.log('No Mermaid diagrams found in file.');
    
    // Show file content start for debugging
    console.log('\nFirst 500 characters of the file:');
    console.log('-'.repeat(50));
    console.log(diagramContent.substring(0, 500) + '...');
    console.log('-'.repeat(50));
  } else {
    console.log(`Found ${index} potential Mermaid diagrams.`);
  }
  
} catch (error) {
  console.error('Error processing file:', error);
}
