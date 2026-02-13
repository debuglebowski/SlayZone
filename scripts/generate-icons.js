#!/usr/bin/env node

const sharp = require('sharp');
const { join } = require('path');
const { mkdirSync, existsSync, rmSync, writeFileSync } = require('fs');
const pngToIco = require('png-to-ico').default;
const { Icns, IcnsImage } = require('@fiahfy/icns');

const APP_DIR = join(__dirname, '../packages/apps/app');
const BUILD_DIR = join(APP_DIR, 'build');
const RESOURCES_DIR = join(APP_DIR, 'resources');
const SOURCE_PNG = join(APP_DIR, 'src/renderer/src/assets/logo-solid.svg');
const LEGACY_ROOT_BUILD_DIR = join(__dirname, '../build');
const LEGACY_ROOT_RESOURCES_DIR = join(__dirname, '../resources');

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
 * Create icon by rendering the source SVG and applying a squircle mask.
 * Following Apple's macOS icon grid specifications
 */
async function createIconWithBackground(size) {
  // Apple's icon grid:
  // - Squircle occupies ~80% of canvas (10% padding on each side)
  // - Corner radius ~22.37% of squircle size
  const squirclePadding = Math.round(size * 0.1);
  const squircleSize = size - (squirclePadding * 2);
  const cornerRadius = Math.round(squircleSize * 0.223);

  const maskSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${squirclePadding}" y="${squirclePadding}" width="${squircleSize}" height="${squircleSize}" rx="${cornerRadius}" ry="${cornerRadius}" fill="#ffffff"/>
  </svg>`;

  const rendered = await sharp(SOURCE_PNG)
    .resize(size, size, { fit: 'cover' })
    .png()
    .toBuffer();

  return sharp(rendered)
    .composite([{ input: Buffer.from(maskSvg), blend: 'dest-in' }])
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

  const iconsetDir = join(BUILD_DIR, 'icon.iconset');
  if (existsSync(iconsetDir)) {
    rmSync(iconsetDir, { recursive: true });
  }
  mkdirSync(iconsetDir, { recursive: true });

  const icns = new Icns();

  const osTypeByFilename = new Map([
    ['icon_16x16.png', 'icp4'],
    ['icon_32x32.png', 'icp5'],
    ['icon_128x128.png', 'ic07'],
    ['icon_256x256.png', 'ic08'],
    ['icon_512x512.png', 'ic09'],
    ['icon_16x16@2x.png', 'ic11'],
    ['icon_32x32@2x.png', 'ic12'],
    ['icon_128x128@2x.png', 'ic13'],
    ['icon_256x256@2x.png', 'ic14'],
    ['icon_512x512@2x.png', 'ic10'],
  ]);

  // Generate correctly named iconset files and build ICNS in pure JS
  for (const [, pixelSize, filename] of ICONSET_FILES) {
    const iconBuffer = await createIconWithBackground(pixelSize);
    writeFileSync(join(iconsetDir, filename), iconBuffer);
    const osType = osTypeByFilename.get(filename);
    if (!osType) {
      throw new Error(`Unsupported icon filename for ICNS mapping: ${filename}`);
    }
    icns.append(IcnsImage.fromPNG(iconBuffer, osType));
  }

  writeFileSync(join(BUILD_DIR, 'icon.icns'), icns.data);
  console.log('✓ Created build/icon.icns');
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

  // Clean up legacy root-level icon output directories from earlier scripts.
  if (existsSync(LEGACY_ROOT_BUILD_DIR)) {
    rmSync(LEGACY_ROOT_BUILD_DIR, { recursive: true, force: true });
    console.log('✓ Removed legacy root build/ directory');
  }
  if (existsSync(LEGACY_ROOT_RESOURCES_DIR)) {
    rmSync(LEGACY_ROOT_RESOURCES_DIR, { recursive: true, force: true });
    console.log('✓ Removed legacy root resources/ directory');
  }
  
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
