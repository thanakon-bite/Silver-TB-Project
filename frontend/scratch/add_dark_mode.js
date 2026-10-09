const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    try {
      filelist = fs.statSync(dirFile).isDirectory() ? walkSync(dirFile, filelist) : filelist.concat(dirFile);
    } catch (err) {
      if (err.code === 'OOM' || err.code === 'EMFILE') throw err;
    }
  });
  return filelist;
};

const classMap = {
  'bg-white': 'bg-white dark:bg-gray-800',
  'bg-gray-50': 'bg-gray-50 dark:bg-gray-900',
  'bg-gray-100': 'bg-gray-100 dark:bg-gray-800',
  'bg-gray-200': 'bg-gray-200 dark:bg-gray-700',
  'bg-silver-light': 'bg-silver-light dark:bg-gray-800',
  'text-gray-900': 'text-gray-900 dark:text-gray-100',
  'text-gray-800': 'text-gray-800 dark:text-gray-200',
  'text-gray-700': 'text-gray-700 dark:text-gray-300',
  'text-gray-600': 'text-gray-600 dark:text-gray-400',
  'text-gray-500': 'text-gray-500 dark:text-gray-400',
  'text-gray-400': 'text-gray-400 dark:text-gray-500',
  'border-gray-100': 'border-gray-100 dark:border-gray-700',
  'border-gray-200': 'border-gray-200 dark:border-gray-700',
  'border-gray-300': 'border-gray-300 dark:border-gray-600',
  'border-silver': 'border-silver dark:border-gray-600',
};

const srcDir = path.join(__dirname, '../src');
const files = walkSync(srcDir).filter(f => f.endsWith('.tsx'));

let changedFiles = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content;

  // Find all className="..." strings and replace inside them
  const regex = /className="([^"]+)"/g;
  newContent = newContent.replace(regex, (match, classStr) => {
    let classes = classStr.split(' ');
    let newClasses = [];
    for (let c of classes) {
      // Don't duplicate dark: classes if they already exist
      if (classMap[c]) {
        const parts = classMap[c].split(' ');
        if (!classes.includes(parts[1])) {
           newClasses.push(parts[0]);
           newClasses.push(parts[1]);
           continue;
        }
      }
      newClasses.push(c);
    }
    // De-duplicate
    newClasses = [...new Set(newClasses)];
    return `className="${newClasses.join(' ')}"`;
  });

  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    changedFiles++;
    console.log(`Updated dark mode classes in ${file}`);
  }
}

console.log(`Done. Changed ${changedFiles} files.`);
