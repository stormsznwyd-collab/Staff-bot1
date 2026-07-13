const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', '..', 'data', 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function timestamp() {
  return new Date().toISOString();
}

function writeToFile(level, message) {
  const file = path.join(LOG_DIR, `${new Date().toISOString().slice(0, 10)}.log`);
  fs.appendFile(file, `[${timestamp()}] [${level}] ${message}\n`, (err) => {
    if (err) console.error('Logger failed to write to file:', err);
  });
}

const COLORS = {
  INFO: '\x1b[36m',
  WARN: '\x1b[33m',
  ERROR: '\x1b[31m',
  SUCCESS: '\x1b[32m',
  RESET: '\x1b[0m',
};

function log(level, message, meta) {
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  const color = COLORS[level] || '';
  console.log(`${color}[${timestamp()}] [${level}]${COLORS.RESET} ${message}${metaStr}`);
  writeToFile(level, `${message}${metaStr}`);
}

module.exports = {
  info: (msg, meta) => log('INFO', msg, meta),
  warn: (msg, meta) => log('WARN', msg, meta),
  error: (msg, meta) => log('ERROR', msg, meta),
  success: (msg, meta) => log('SUCCESS', msg, meta),
};
