const fs = require('fs');
const path = require('path');

const directory = path.join(__dirname, 'apps/web/src');

function replaceColors(content) {
  let newContent = content;
  
  // Replace all indigo colors with semantic primary
  const replacements = {
    'bg-indigo-600': 'bg-primary',
    'bg-indigo-500': 'bg-primary',
    'bg-indigo-400': 'bg-primary/60',
    'bg-indigo-50': 'bg-primary/10',
    
    'text-indigo-900': 'text-primary',
    'text-indigo-800': 'text-primary',
    'text-indigo-700': 'text-primary',
    'text-indigo-600': 'text-primary',
    'text-indigo-500': 'text-primary/80',
    'text-indigo-400': 'text-primary/60',
    
    'border-indigo-600': 'border-primary',
    'border-indigo-500': 'border-primary',
    'border-indigo-100/50': 'border-primary/20',
    'border-indigo-100': 'border-primary/20',
    
    'ring-indigo-600': 'ring-primary',
    'ring-indigo-500': 'ring-primary',
    
    'accent-indigo-600': 'accent-primary',
    'accent-indigo-500': 'accent-primary',
    
    'from-indigo-50': 'from-primary/10',
    'to-indigo-100/50': 'to-primary/10',
    'to-indigo-100': 'to-primary/10'
  };

  for (const [key, value] of Object.entries(replacements)) {
    // We use a global regex replacement
    // To ensure we match complete tailwind classes, we can just replace the strings globally.
    // E.g., `bg-indigo-600` is usually bounded by quotes or spaces.
    newContent = newContent.split(key).join(value);
  }
  
  return newContent;
}

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      if (f.endsWith('.tsx') || f.endsWith('.ts')) {
        callback(path.join(dir, f));
      }
    }
  });
}

walkDir(directory, function(filePath) {
  const originalContent = fs.readFileSync(filePath, 'utf-8');
  const updatedContent = replaceColors(originalContent);
  if (originalContent !== updatedContent) {
    console.log('Updated', filePath);
    fs.writeFileSync(filePath, updatedContent, 'utf-8');
  }
});
