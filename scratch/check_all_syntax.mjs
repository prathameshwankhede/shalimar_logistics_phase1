// scratch/check_all_syntax.mjs
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        getAllFiles(fullPath, arrayOfFiles);
      }
    } else if (file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.cjs')) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

const allJsFiles = getAllFiles(process.cwd());
console.log(`Checking ${allJsFiles.length} JS/MJS/CJS files...`);

for (const file of allJsFiles) {
  try {
    execSync(`node --check "${file}"`, { stdio: 'pipe' });
  } catch (err) {
    console.error(`❌ Syntax Error in ${file}:`);
    console.error(err.stderr ? err.stderr.toString() : err.message);
  }
}
console.log('Syntax check complete.');
