const fs = require('fs');
const path = require('path');
const { AttachmentBuilder } = require('discord.js');
const logger = require('../utils/logger');

/**
 * Generates personalized ban-appeal card images by drawing the real username
 * onto the template art (the SnoopLife cards), so DMs look EXACTLY like the
 * designs instead of a plain embed.
 *
 * Requires the optional `@napi-rs/canvas` package. If it isn't installed, or a
 * template/layout is missing, every function degrades gracefully (ready() ->
 * false, buildAppealCard() -> null) and the appeal system falls back to embeds.
 * Install with:  npm install @napi-rs/canvas
 */

let canvas = null;
try {
  // eslint-disable-next-line global-require
  canvas = require('@napi-rs/canvas');
} catch {
  logger.warn('@napi-rs/canvas not installed — appeal cards will fall back to embeds. Run `npm install @napi-rs/canvas` to enable image cards.');
}

const ASSET_DIR = path.join(__dirname, '..', 'assets', 'appeals');
const FONT_DIR = path.join(__dirname, '..', 'assets', 'fonts');
const FONT_BODY = 'AppealBody';
const FONT_BOLD = 'AppealBodyBold';

let layoutCache = null;
let fontsRegistered = false;

function ready() {
  return Boolean(canvas) && fs.existsSync(path.join(ASSET_DIR, 'layout.json'));
}

function loadLayout() {
  if (layoutCache) return layoutCache;
  layoutCache = JSON.parse(fs.readFileSync(path.join(ASSET_DIR, 'layout.json'), 'utf8'));
  return layoutCache;
}

function ensureFonts() {
  if (!canvas || fontsRegistered) return;
  const reg = path.join(FONT_DIR, 'body.ttf');
  const bold = path.join(FONT_DIR, 'body-bold.ttf');
  try {
    if (fs.existsSync(reg)) canvas.GlobalFonts.registerFromPath(reg, FONT_BODY);
    if (fs.existsSync(bold)) canvas.GlobalFonts.registerFromPath(bold, FONT_BOLD);
  } catch (err) {
    logger.warn('Could not register appeal card fonts', { err: err.message });
  }
  fontsRegistered = true;
}

function rgbFromPixel(data) {
  return `rgb(${data[0]},${data[1]},${data[2]})`;
}

/**
 * Returns a discord.js AttachmentBuilder for the personalized card, or null if
 * cards are unavailable so the caller can fall back to an embed.
 *
 * @param {string} status  one of: pending | accepted | denied | anticheat
 * @param {object} opts    { username }
 */
async function buildAppealCard(status, { username } = {}) {
  if (!canvas || !username) return null;
  let cfg;
  try {
    cfg = loadLayout()[status];
  } catch (err) {
    logger.warn('Could not read appeal layout.json', { err: err.message });
    return null;
  }
  if (!cfg) return null;

  const templatePath = path.join(ASSET_DIR, cfg.template);
  if (!fs.existsSync(templatePath)) return null;

  try {
    ensureFonts();
    const img = await canvas.loadImage(templatePath);
    const c = canvas.createCanvas(img.width, img.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);

    // Refill the baked "Hello {user}," line so we can redraw it with the real name.
    const [cx1, cy1, cx2, cy2] = cfg.cover;
    let fill = cfg.bg;
    if (cfg.bgSample) {
      const [sx, sy] = cfg.bgSample;
      const px = ctx.getImageData(sx, sy, 1, 1).data;
      fill = rgbFromPixel(px);
    }
    ctx.fillStyle = fill || 'rgb(20,20,20)';
    ctx.fillRect(cx1, cy1, cx2 - cx1, cy2 - cy1);

    // Draw "Hello NAME," fitting within the available width.
    const [px, py] = cfg.pos;
    const maxWidth = cx2 - px - 6;
    let size = cfg.fontSize;
    ctx.textBaseline = 'top';

    const measureLine = () => {
      ctx.font = `${size}px "${FONT_BODY}"`;
      const helloW = ctx.measureText('Hello ').width;
      ctx.font = `${size}px "${FONT_BOLD}"`;
      const nameW = ctx.measureText(username).width;
      ctx.font = `${size}px "${FONT_BODY}"`;
      const commaW = ctx.measureText(',').width;
      return helloW + nameW + commaW;
    };
    while (measureLine() > maxWidth && size > 12) size -= 1;

    let x = px;
    ctx.fillStyle = cfg.hello;
    ctx.font = `${size}px "${FONT_BODY}"`;
    ctx.fillText('Hello ', x, py);
    x += ctx.measureText('Hello ').width;

    ctx.fillStyle = cfg.name;
    ctx.font = `${size}px "${FONT_BOLD}"`;
    ctx.fillText(username, x, py);
    x += ctx.measureText(username).width;

    ctx.fillStyle = cfg.hello;
    ctx.font = `${size}px "${FONT_BODY}"`;
    ctx.fillText(',', x, py);

    const buffer = c.toBuffer('image/png');
    return new AttachmentBuilder(buffer, { name: `appeal-${status}.png` });
  } catch (err) {
    logger.error('Failed to build appeal card', { status, err: err.message });
    return null;
  }
}

module.exports = { ready, buildAppealCard };
