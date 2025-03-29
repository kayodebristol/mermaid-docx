#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
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

// Version-independent delay function to replace waitForTimeout
async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Find the first existing Chrome/Chromium
function findChrome() {
  for (const chromePath of possibleChromePaths) {
    try {
      if (fs.existsSync(chromePath)) {
        console.error(`Found browser: ${chromePath}`);
        return chromePath;
      }
    } catch (e) {
      // Ignore errors
    }
  }
  return null; // No Chrome found
}

// Create a better HTML template with proper Mermaid initialization
function createHtmlContent(mermaidCode) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Mermaid Diagram</title>
      <script src="https://cdn.jsdelivr.net/npm/mermaid@8.14.0/dist/mermaid.min.js"></script>
      <style>
        body { margin: 0; padding: 20px; }
        .mermaid { max-width: 100%; }
      </style>
    </head>
    <body>
      <pre class="mermaid">
${mermaidCode}
      </pre>
      <script>
        // Set a timeout to fail fast if rendering doesn't work
        const renderTimeout = setTimeout(() => {
          console.log('Rendering timed out, setting rendered flag anyway');
          window.mermaidRendered = true;
        }, 5000);
        
        mermaid.initialize({
          startOnLoad: true,
          theme: 'default',
          logLevel: 'debug',
          securityLevel: 'loose',
          fontFamily: 'arial, sans-serif',
          // Make diagrams more compact for docx embedding
          gantt: { titleTopMargin: 10 },
          flowchart: { padding: 5, useMaxWidth: true },
          sequence: { useMaxWidth: true },
        });
        
        // Create a global variable to indicate when rendering is done
        window.mermaidRendered = false;
        
        // Override the render function to set our flag when done
        const originalRender = mermaid.render;
        mermaid.render = function(id, text, callback, container) {
          return originalRender(id, text, function(svgCode, bindFunctions) {
            clearTimeout(renderTimeout);
            if (callback) callback(svgCode, bindFunctions);
            window.mermaidRendered = true;
            console.log('Mermaid rendering completed');
          }, container);
        };
        
        // Extra safety - ensure we don't hang
        document.addEventListener('DOMContentLoaded', function() {
          console.log('DOM loaded, initializing mermaid');
          try {
            mermaid.init(undefined, document.querySelectorAll('.mermaid'));
            console.log('Mermaid init called');
          } catch (error) {
            console.error('Mermaid initialization error:', error);
            window.mermaidRendered = true; // Force completion even on error
          }
        });
      </script>
    </body>
    </html>
  `;
}

// Render a Mermaid diagram using Puppeteer
async function renderMermaid(mermaidFile, svgPath) {
  // Create an overall timeout for the entire render process
  const timeout = setTimeout(() => {
    console.error('Global rendering timeout reached (15s)');
    process.exit(1);
  }, 15000);
  
  let browser = null;
  
  try {
    // Read the Mermaid code from the file
    const mermaidCode = fs.readFileSync(mermaidFile, 'utf8');
    console.error(`Processing diagram (${mermaidCode.length} bytes)`);
    
    // Create a temporary HTML file with our improved template
    const htmlPath = mermaidFile + '.html';
    fs.writeFileSync(htmlPath, createHtmlContent(mermaidCode));
    
    const executablePath = findChrome();
    browser = await puppeteer.launch({
      executablePath: executablePath || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
      timeout: 10000
    });
    
    const page = await browser.newPage();
    
    // Enable console logging from the browser
    page.on('console', (msg) => console.error(`Browser console: ${msg.text()}`));
    page.on('error', (err) => console.error('Browser error:', err));
    page.on('pageerror', (err) => console.error('Page error:', err));
    
    // Get the absolute file URL
    const fileUrl = `file://${path.resolve(htmlPath)}`;
    console.error(`Loading page: ${fileUrl}`);
    
    await page.goto(fileUrl, {
      waitUntil: 'networkidle0',
      timeout: 8000
    });
    
    console.error('Page loaded, waiting for Mermaid rendering');
    
    // Try multiple selectors and methods to detect when rendering is complete
    let renderSuccess = false;
    
    try {
      // First try waiting for our custom flag
      await page.waitForFunction('window.mermaidRendered === true', { 
        timeout: 6000,
        polling: 100
      });
      console.error('Mermaid render flag detected');
      renderSuccess = true;
    } catch (err) {
      console.error('Waiting for mermaidRendered flag failed, trying selector');
    }
    
    if (!renderSuccess) {
      try {
        // Fall back to waiting for the selector
        await page.waitForSelector('.mermaid svg', { timeout: 3000 });
        console.error('SVG element found via selector');
        renderSuccess = true;
      } catch (err) {
        console.error('SVG selector also failed, will attempt to extract anyway');
      }
    }
    
    // Wait a moment to ensure rendering completes
    await delay(500);
    
    // Get the SVG content directly
    const svgContent = await page.evaluate(() => {
      const svg = document.querySelector('.mermaid svg');
      if (svg) {
        // Ensure SVG has proper XML declaration and dimensions for conversion
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        if (!svg.hasAttribute('width')) svg.setAttribute('width', '800');
        if (!svg.hasAttribute('height')) svg.setAttribute('height', '600');
        return svg.outerHTML;
      }
      return null;
    });
    
    if (svgContent) {
      // Write the SVG content directly with XML declaration for better compatibility
      const xmlDeclaration = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n';
      fs.writeFileSync(svgPath, xmlDeclaration + svgContent);
      console.error(`Successfully wrote SVG to ${svgPath}`);
      
      // Clean up and finish
      await browser.close();
      browser = null;
      fs.unlinkSync(htmlPath);
      clearTimeout(timeout);
      return true;
    }
    
    // Try screenshot as fallback
    console.error('No SVG element found, using screenshot fallback');
    
    const element = await page.$('.mermaid');
    if (element) {
      await element.screenshot({
        path: svgPath.replace('.svg', '.png'),
        omitBackground: true
      });
      console.error(`Saved screenshot to ${svgPath.replace('.svg', '.png')}`);
      
      // Create a simple SVG wrapper for the PNG to maintain compatibility
      const pngPath = svgPath.replace('.svg', '.png');
      const pngFilename = path.basename(pngPath);
      const simpleSvg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="800" height="600">
  <image width="800" height="600" href="${pngFilename}" />
</svg>`;
      
      fs.writeFileSync(svgPath, simpleSvg);
      console.error(`Created SVG wrapper for PNG at ${svgPath}`);
      
      // Clean up and finish
      await browser.close();
      browser = null;
      fs.unlinkSync(htmlPath);
      clearTimeout(timeout);
      return true;
    }
    
    throw new Error('Failed to render diagram - no SVG or screenshot produced');
  } catch (error) {
    console.error('Error rendering diagram:', error.message);
    
    // Clean up in case of errors
    if (browser) {
      try {
        await browser.close();
      } catch (e) { /* ignore close errors */ }
    }
    
    clearTimeout(timeout);
    
    // Create a fallback SVG with error information - ensure it has valid XML and dimensions
    const errorSvg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" width="500" height="100">
  <rect width="500" height="100" fill="#ffcccc" />
  <text x="10" y="30" font-family="Arial" font-size="12">Error rendering diagram:</text>
  <text x="10" y="50" font-family="Arial" font-size="12">${error.message.replace(/"/g, "'")}</text>
  <text x="10" y="80" font-family="Arial" font-size="10">Check conversion.log for details</text>
</svg>`;
    
    fs.writeFileSync(svgPath, errorSvg);
    console.error(`Created error SVG at ${svgPath}`);
    
    // Don't throw, just return false to indicate failure but allow process to continue
    return false;
  }
}

// Main script logic
async function main() {
  if (process.argv.length < 4) {
    console.error('Usage: node render-mermaid.js <mermaid-file> <output-svg>');
    process.exit(1);
  }
  
  const mermaidFile = process.argv[2];
  const svgPath = process.argv[3];
  
  try {
    const result = await renderMermaid(mermaidFile, svgPath);
    if (result) {
      console.error(`Successfully rendered diagram to ${svgPath}`);
      process.exit(0);
    } else {
      console.error(`Diagram rendering failed but fallback was created`);
      process.exit(0); // Still exit with 0 to continue the process
    }
  } catch (error) {
    console.error(`Failed to render diagram: ${error.message}`);
    process.exit(1);
  }
}

// Run the main function
main();
