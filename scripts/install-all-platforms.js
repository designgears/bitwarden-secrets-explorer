const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const platforms = [
  { name: '@bitwarden/sdk-napi-win32-x64-msvc', version: '1.0.0', folder: 'sdk-napi-win32-x64-msvc' },
  { name: '@bitwarden/sdk-napi-darwin-x64', version: '1.0.0', folder: 'sdk-napi-darwin-x64' },
  { name: '@bitwarden/sdk-napi-darwin-arm64', version: '1.0.0', folder: 'sdk-napi-darwin-arm64' },
  { name: '@bitwarden/sdk-napi-linux-x64-gnu', version: '1.0.0', folder: 'sdk-napi-linux-x64-gnu' }
];

const targetDir = path.join(__dirname, '..', 'node_modules', '@bitwarden');
const tempDir = path.join(__dirname, '..', '.temp-platforms');

console.log('Downloading all platform-specific Bitwarden SDK binaries...\n');

// Create directories if they don't exist
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Create a temporary package.json for installing packages
const tempPackageJson = path.join(tempDir, 'package.json');
fs.writeFileSync(tempPackageJson, JSON.stringify({
  name: 'temp-platform-installer',
  version: '1.0.0',
  private: true
}, null, 2));

for (const platform of platforms) {
  const pkg = `${platform.name}@${platform.version}`;
  const targetPath = path.join(targetDir, platform.folder);

  console.log(`Processing ${pkg}...`);

  // Skip if already exists
  if (fs.existsSync(targetPath)) {
    console.log(`  ✓ Already installed at ${platform.folder}`);
    continue;
  }

  try {
    // Install the package in temp directory, ignoring platform checks
    console.log(`  Downloading...`);
    execSync(`npm install --no-save --force ${pkg}`, {
      cwd: tempDir,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Move from temp node_modules to target
    const sourcePath = path.join(tempDir, 'node_modules', '@bitwarden', platform.folder);
    if (fs.existsSync(sourcePath)) {
      // Copy directory recursively
      copyDir(sourcePath, targetPath);
      console.log(`  ✓ Installed to ${platform.folder}`);
    } else {
      console.error(`  ✗ Could not find extracted package at ${sourcePath}`);
    }
  } catch (error) {
    console.error(`  ✗ Failed to install ${platform.name}: ${error.message}`);
  }
}

// Clean up temp directory
try {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
} catch (error) {
  console.warn(`Could not clean up temp directory: ${error.message}`);
}

console.log('\nAll platform binaries have been installed!');

// Helper function to copy directory recursively
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
