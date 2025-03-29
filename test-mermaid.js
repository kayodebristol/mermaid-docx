#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const puppeteer = require('puppeteer');

// Possible Chrome/Chromium paths on Linux
const possibleChromePaths = [
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
  '/usr/bin/brave-browser',
  '/usr/bin/microsoft-edge'
];

// Find the first existing Chrome/Chromium
function findChrome() {
  for (const chromePath of possibleChromePaths) {
    try {
      if (fs.existsSync(chromePath)) {
        console.log(`Found browser: ${chromePath}`);
        return chromePath;
      }
    } catch (e) {
      // Ignore errors
    }
  }
  return null; // No Chrome found
}

// Simple HTML template for rendering Mermaid diagrams
const mermaidTemplate = (diagram) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'default',
      securityLevel: 'loose',
      logLevel: 3
    });
  </script>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: white;
    }
  </style>
</head>
<body>
  <div class="mermaid">
    ${diagram}
  </div>
</body>
</html>
`;

// Verify file exists and is accessible
function verifyFile(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    const stats = fs.statSync(filePath);
    console.log(`File ${filePath} exists and is ${stats.size} bytes`);
    return true;
  } catch (err) {
    console.error(`File access error for ${filePath}: ${err.message}`);
    return false;
  }
}

// Render a Mermaid diagram using Puppeteer
async function renderMermaid(diagram) {
  const id = uuidv4();
  const tempDir = path.resolve(process.cwd(), 'temp');
  
  // Create the temp directory if it doesn't exist
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const htmlPath = path.join(tempDir, `diagram-${id}.html`);
  const pngPath = path.join(tempDir, `diagram-${id}.png`);
  
  console.log(`Creating HTML file at: ${htmlPath}`);
  fs.writeFileSync(htmlPath, mermaidTemplate(diagram));
  
  verifyFile(htmlPath);
  
  // Get the absolute file URL
  const fileUrl = `file://${path.resolve(htmlPath)}`;
  console.log(`Loading diagram from: ${fileUrl}`);
  
  try {
    const executablePath = findChrome();
    const browser = await puppeteer.launch({
      executablePath: executablePath || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.goto(fileUrl, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    await page.waitForSelector('.mermaid svg', { timeout: 10000 });
    
    // Take screenshot
    const element = await page.$('.mermaid');
    await element.screenshot({
      path: pngPath,
      omitBackground: true
    });
    
    await browser.close();
    
    console.log(`Diagram rendered successfully to ${pngPath}`);
    return pngPath;
  } catch (error) {
    console.error('Error rendering diagram:', error);
    throw error;
  }
}

// Simple test function
async function testMermaid() {
  if (process.argv.length < 3) {
    console.log('Usage: node test-mermaid.js <diagram-text OR path-to-diagram-file>');
    process.exit(1);
  }
  
  let diagram = process.argv[2];
  
  // If the argument is a file path, read the file
  if (fs.existsSync(diagram)) {
    console.log(`Reading diagram from file: ${diagram}`);
    diagram = fs.readFileSync(diagram, 'utf8');
  }
  
  try {
    const outputPath = await renderMermaid(diagram);
    console.log(`Success! Diagram saved to: ${outputPath}`);
  } catch (err) {
    console.error(`Failed to render diagram: ${err.message}`);
    process.exit(1);
  }
}

// Run the test
testMermaid();
