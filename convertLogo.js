import fs from 'fs';

const srcPath = 'C:/Users/acer/.gemini/antigravity/brain/596e0ebd-18bd-44f3-9a44-e4ada52c7725/.user_uploaded/media_1786686244668.jpg';
const destPath = 'C:/Users/acer/.gemini/antigravity/scratch/transflow-logistics/src/assets/logoBase64.js';

const imgBuf = fs.readFileSync(srcPath);
const b64 = imgBuf.toString('base64');
const content = `export const SHALIMAR_LOGO_BASE64 = "data:image/jpeg;base64,${b64}";\n`;

fs.writeFileSync(destPath, content);
console.log('Converted REAL USER UPLOADED LOGO (media_1786686244668.jpg) to Base64! Length:', content.length);
