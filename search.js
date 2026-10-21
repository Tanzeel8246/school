const fs = require('fs');
const path = require('path');

const regex = /INR|₹|India|Aadhaar|Aadhar/gi;
const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.next', '.gemini'];

function searchDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (!ignoreDirs.includes(file)) {
                searchDir(fullPath);
            }
        } else if (stat.isFile() && !fullPath.endsWith('.png') && !fullPath.endsWith('.jpg') && !fullPath.endsWith('.log')) {
            try {
                const content = fs.readFileSync(fullPath, 'utf8');
                const lines = content.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].match(regex)) {
                        console.log(`${fullPath}:${i + 1}: ${lines[i].trim()}`);
                    }
                }
            } catch (e) {
                // ignore binary files or read errors
            }
        }
    }
}

searchDir('.');
