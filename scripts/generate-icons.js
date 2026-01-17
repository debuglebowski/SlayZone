#!/usr/bin/env node

const sharp = require('sharp');
const { execSync } = require('child_process');
const { join } = require('path');
const { mkdirSync, existsSync, rmSync, writeFileSync } = require('fs');
const pngToIco = require('png-to-ico');

const SVG_PATH = join(__dirname, '../src/renderer/src/assets/logo-solid.svg');
const BUILD_DIR = join(__dirname, '../build');
const RESOURCES_DIR = join(__dirname, '../resources');

// Icon sizes for different platforms
const PNG_SIZES = [16, 32, 48, 64, 128, 256, 512, 1024];
const ICNS_SIZES = [16, 32, 64, 128, 256, 512, 1024]; // macOS ICNS sizes
const ICO_SIZES = [16, 32, 48, 64, 128, 256]; // Windows ICO sizes

async function generatePNGs() {
  console.log('Generating PNG files...');
  
  // Generate PNG for resources (Linux window icon)
  await sharp(SVG_PATH)
    .resize(512, 512)
    .png()
    .toFile(join(RESOURCES_DIR, 'icon.png'));
  console.log('✓ Created resources/icon.png (512x512)');

  // Generate PNG for build directory (electron-builder)
  await sharp(SVG_PATH)
    .resize(1024, 1024)
    .png()
    .toFile(join(BUILD_DIR, 'icon.png'));
  console.log('✓ Created build/icon.png (1024x1024)');
}

async function generateICNS() {
  console.log('Generating ICNS file for macOS...');
  
  if (process.platform !== 'darwin') {
    console.log('⚠ Skipping ICNS generation (requires macOS)');
    return;
  }

  // Create temporary iconset directory
  const iconsetDir = join(BUILD_DIR, 'icon.iconset');
  if (existsSync(iconsetDir)) {
    rmSync(iconsetDir, { recursive: true });
  }
  mkdirSync(iconsetDir, { recursive: true });

  // Generate PNG files for iconset
  for (const size of ICNS_SIZES) {
    const filename = size === 1024 ? 'icon_512x512@2x.png' : `icon_${size}x${size}.png`;
    await sharp(SVG_PATH)
      .resize(size, size)
      .png()
      .toFile(join(iconsetDir, filename));
  }

  // Use iconutil to create ICNS file
  try {
    execSync(`iconutil -c icns "${iconsetDir}" -o "${join(BUILD_DIR, 'icon.icns')}"`);
    console.log('✓ Created build/icon.icns');
    
    // Clean up iconset directory
    rmSync(iconsetDir, { recursive: true });
  } catch (error) {
    console.error('✗ Failed to create ICNS file:', error.message);
  }
}

async function generateICO() {
  console.log('Generating ICO file for Windows...');
  
  try {
    // Generate PNG files at multiple sizes for ICO
    const pngBuffers = [];
    for (const size of ICO_SIZES) {
      const buffer = await sharp(SVG_PATH)
        .resize(size, size)
        .png()
        .toBuffer();
      pngBuffers.push(buffer);
    }
    
    // Convert PNG buffers to ICO
    const icoBuffer = await pngToIco(pngBuffers);
    writeFileSync(join(BUILD_DIR, 'icon.ico'), icoBuffer);
    console.log('✓ Created build/icon.ico (multi-size)');
  } catch (error) {
    console.error('✗ Failed to create ICO file:', error.message);
    // Fallback: create PNG and let electron-builder handle conversion
    console.log('  Creating PNG fallback...');
    await sharp(SVG_PATH)
      .resize(256, 256)
      .png()
      .toFile(join(BUILD_DIR, 'icon-256.png'));
  }
}

async function main() {
  console.log('Starting icon generation...\n');
  
  // Ensure directories exist
  if (!existsSync(BUILD_DIR)) {
    mkdirSync(BUILD_DIR, { recursive: true });
  }
  if (!existsSync(RESOURCES_DIR)) {
    mkdirSync(RESOURCES_DIR, { recursive: true });
  }

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
