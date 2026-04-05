'use strict';

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import archiver from 'archiver';

// NOTE: only include production-relevant paths in the zip:
const INCLUDE = [
  '.composer/**',
  'build/**',
  'config/**',
  'index.js',
  'package.json',
  'package-lock.json',
];

// NOTE: exclude TypeScript types which have no runtime value.
//       AWS SDK v3 is NOT bundled in Lambda runtimes nodejs22+ so it must
//       remain in the zip:
const EXCLUDE_NODE_MODULES = [
  'node_modules/@types/**',
];

const copyToTemp = (srcDir: string, destDir: string): void => {
  fs.cpSync(srcDir, destDir, { recursive: true });
};

const createZip = async (name: string): Promise<string> => {
  const srcDir = process.cwd();
  const outDir = path.join(srcDir, '.serverless');
  const outputPath = path.join(outDir, `${name}-${Date.now()}.zip`);

  fs.mkdirSync(outDir, { recursive: true });

  // NOTE: Copy project to a temp directory and prune devDependencies there,
  //       so the zip only contains production node_modules:
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

  try {
    console.log('Building...');
    execSync('npm run build', { cwd: srcDir, stdio: 'inherit' });

    console.log('Packaging...');
    copyToTemp(srcDir, tmpDir);
    execSync('npm prune --omit=dev', { cwd: tmpDir, stdio: 'ignore' });

    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 6 } });

      output.on('close', () => resolve());
      archive.on('error', reject);
      archive.pipe(output);

      for (const pattern of INCLUDE) {
        archive.glob(pattern, { cwd: tmpDir });
      }

      archive.glob('node_modules/**', { cwd: tmpDir, ignore: EXCLUDE_NODE_MODULES });

      archive.finalize();
    });

  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });

  }

  return outputPath;
};

export default createZip;
