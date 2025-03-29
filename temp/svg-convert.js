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
