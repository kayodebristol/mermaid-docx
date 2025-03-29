#!/usr/bin/env node

const fs = require('fs');
const { createCanvas } = require('canvas');

// Create a 400x200 canvas
const canvas = createCanvas(400, 200);
const ctx = canvas.getContext('2d');

// Draw a red background
ctx.fillStyle = '#ffcccc';
ctx.fillRect(0, 0, 400, 200);

// Add error text
ctx.fillStyle = '#000000';
ctx.font = '14px Arial';
ctx.fillText('Error rendering diagram', 20, 50);
ctx.font = '12px Arial';
ctx.fillText('Conversion to PNG failed', 20, 80);
ctx.fillText('Check conversion.log for details', 20, 110);

// Save to file
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('error.png', buffer);

console.log('Created error.png');
