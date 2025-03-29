const {join} = require('path');
const os = require('os');
const fs = require('fs');

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
  for (const path of possibleChromePaths) {
    try {
      if (fs.existsSync(path)) {
        return path;
      }
    } catch (e) {
      // Ignore errors
    }
  }
  return null; // No Chrome found
}

const executablePath = findChrome();

/**
 * @type {import('puppeteer').Configuration}
 */
module.exports = {
  // Changes the cache location for Puppeteer.
  cacheDirectory: join(os.homedir(), '.cache', 'puppeteer'),
  executablePath: executablePath
};
