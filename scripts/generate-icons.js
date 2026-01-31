#!/usr/bin/env node

const sharp = require('sharp');
const { execSync } = require('child_process');
const { join } = require('path');
const { mkdirSync, existsSync, rmSync, writeFileSync } = require('fs');
const pngToIco = require('png-to-ico').default;

const BUILD_DIR = join(__dirname, '../build');
const RESOURCES_DIR = join(__dirname, '../resources');

// Background color matching app theme
const BG_COLOR = '#0a0a0a';
// Logo color (light gray/white for contrast)
const LOGO_COLOR = '#e5e5e5';

// Correct iconset pairs: [display_size, actual_pixel_size, filename]
const ICONSET_FILES = [
  [16, 16, 'icon_16x16.png'],
  [16, 32, 'icon_16x16@2x.png'],
  [32, 32, 'icon_32x32.png'],
  [32, 64, 'icon_32x32@2x.png'],
  [128, 128, 'icon_128x128.png'],
  [128, 256, 'icon_128x128@2x.png'],
  [256, 256, 'icon_256x256.png'],
  [256, 512, 'icon_256x256@2x.png'],
  [512, 512, 'icon_512x512.png'],
  [512, 1024, 'icon_512x512@2x.png'],
];

const ICO_SIZES = [16, 32, 48, 64, 128, 256];

/**
 * Create icon with transparent background and squircle shape
 * Following Apple's macOS icon grid specifications
 */
async function createIconWithBackground(size) {
  // Apple's icon grid:
  // - Squircle occupies ~80% of canvas (10% padding on each side)
  // - Corner radius ~22.37% of squircle size
  const squirclePadding = Math.round(size * 0.1);
  const squircleSize = size - (squirclePadding * 2);
  const cornerRadius = Math.round(squircleSize * 0.223);
  
  // Content safe zone: ~17.5% padding inside squircle
  const contentPadding = Math.round(squircleSize * 0.175);
  const logoSize = squircleSize - (contentPadding * 2);

  // Transparent canvas with only the squircle shape filled
  const backgroundSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${squirclePadding}" y="${squirclePadding}" width="${squircleSize}" height="${squircleSize}" rx="${cornerRadius}" ry="${cornerRadius}" fill="${BG_COLOR}"/>
  </svg>`;

  const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${logoSize}" height="${logoSize}">
    <path d="M8,48 L14,24 L24,36 L32,16 L40,36 L50,24 L56,48 Z" stroke="${LOGO_COLOR}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>`;

  const logoBuffer = await sharp(Buffer.from(logoSvg)).png().toBuffer();

  return sharp(Buffer.from(backgroundSvg))
    .composite([{
      input: logoBuffer,
      top: squirclePadding + contentPadding,
      left: squirclePadding + contentPadding
    }])
    .png()
    .toBuffer();
}

async function generatePNGs() {
  console.log('Generating PNG files...');

  const icon512 = await createIconWithBackground(512);
  writeFileSync(join(RESOURCES_DIR, 'icon.png'), icon512);
  console.log('✓ Created resources/icon.png (512x512)');

  const icon1024 = await createIconWithBackground(1024);
  writeFileSync(join(BUILD_DIR, 'icon.png'), icon1024);
  console.log('✓ Created build/icon.png (1024x1024)');
}

async function generateICNS() {
  console.log('Generating ICNS file for macOS...');
  
  if (process.platform !== 'darwin') {
    console.log('⚠ Skipping ICNS generation (requires macOS)');
    return;
  }

  const iconsetDir = join(BUILD_DIR, 'icon.iconset');
  if (existsSync(iconsetDir)) {
    rmSync(iconsetDir, { recursive: true });
  }
  mkdirSync(iconsetDir, { recursive: true });

  // Generate correctly named iconset files
  for (const [, pixelSize, filename] of ICONSET_FILES) {
    const iconBuffer = await createIconWithBackground(pixelSize);
    writeFileSync(join(iconsetDir, filename), iconBuffer);
  }

  try {
    execSync(`iconutil -c icns "${iconsetDir}" -o "${join(BUILD_DIR, 'icon.icns')}"`);
    console.log('✓ Created build/icon.icns');
    rmSync(iconsetDir, { recursive: true });
  } catch (error) {
    console.error('✗ Failed to create ICNS file:', error.message);
  }
}

async function generateICO() {
  console.log('Generating ICO file for Windows...');
  
  try {
    const pngBuffers = [];
    for (const size of ICO_SIZES) {
      const buffer = await createIconWithBackground(size);
      pngBuffers.push(buffer);
    }
    
    const icoBuffer = await pngToIco(pngBuffers);
    writeFileSync(join(BUILD_DIR, 'icon.ico'), icoBuffer);
    console.log('✓ Created build/icon.ico (multi-size)');
  } catch (error) {
    console.error('✗ Failed to create ICO file:', error.message);
  }
}

async function main() {
  console.log('Starting icon generation...\n');
  
  if (!existsSync(BUILD_DIR)) mkdirSync(BUILD_DIR, { recursive: true });
  if (!existsSync(RESOURCES_DIR)) mkdirSync(RESOURCES_DIR, { recursive: true });

  try {
    await generatePNGs();
    await generateICNS();
    await generateICO();
    console.log('\n✓ Icon generation complete!');
  } catch (error) {
    console.error('\n✗ Error generating icons:', error);
    process.exit(1);
  }
}

main();
