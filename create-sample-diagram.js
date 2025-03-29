#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Very simple Mermaid diagram
const sampleDiagram = `
\`\`\`mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
\`\`\`
`;

// More complex diagram
const complexDiagram = `
\`\`\`mermaid
flowchart TD
    A[Christmas] -->|Get money| B(Go shopping)
    B --> C{Let me think}
    C -->|One| D[Laptop]
    C -->|Two| E[iPhone]
    C -->|Three| F[fa:fa-car Car]
\`\`\`
`;

// Alternative syntax example
const altSyntaxDiagram = `
\`\`\`{.mermaid}
sequenceDiagram
    Alice->>John: Hello John, how are you?
    John-->>Alice: Great!
    Alice-)John: See you later!
\`\`\`
`;

// Create a sample Markdown file with multiple diagrams
const sampleMd = `
# Sample Markdown with Mermaid Diagrams

This is a test file with multiple Mermaid diagrams in different formats.

## Basic Diagram

${sampleDiagram}

## Complex Diagram

${complexDiagram}

## Alternative Syntax

${altSyntaxDiagram}
`;

// Write the sample file
const outputFile = path.join(process.cwd(), 'sample-diagrams.md');
fs.writeFileSync(outputFile, sampleMd);

console.log(`Sample Markdown with diagrams created at: ${outputFile}`);
console.log('You can now test with:');
console.log(`  node debug-diagram.js ${outputFile}`);
console.log(`  ./convert.sh ${outputFile} sample-output.docx`);
