'use strict';

import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';

const IGNORE = [
  'test/**',
  'bin/**',
  'coverage/**',
  '.git/**',
  '.serverless/**',
  '.nyc_output/**',
];

const createZip = (name: string): Promise<string> => {
  const dir = path.join(process.cwd(), '.serverless');
  const outputPath = path.join(dir, `${name}-${Date.now()}.zip`);

  fs.mkdirSync(dir, { recursive: true });

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 6 } });

    output.on('close', () => resolve(outputPath));
    archive.on('error', reject);
    archive.pipe(output);

    archive.glob('**', {
      cwd: process.cwd(),
      dot: true,
      ignore: IGNORE,
    });

    archive.finalize();
  });
};

export default createZip;
