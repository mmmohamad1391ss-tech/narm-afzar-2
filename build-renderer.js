// Assembles app/index.html from src/ parts and copies the bundled fonts.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), nm = p => path.join(root, 'node_modules', p);
fs.mkdirSync(path.join(root, 'app/fonts'), { recursive: true });
const fonts = {
  'bricolage-wdth.woff2': '@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wdth-normal.woff2',
  'instrument-400.woff2': '@fontsource/instrument-sans/files/instrument-sans-latin-400-normal.woff2',
  'instrument-500.woff2': '@fontsource/instrument-sans/files/instrument-sans-latin-500-normal.woff2',
  'instrument-600.woff2': '@fontsource/instrument-sans/files/instrument-sans-latin-600-normal.woff2'
};
for (const [to, from] of Object.entries(fonts)) fs.copyFileSync(nm(from), path.join(root, 'app/fonts', to));
const read = f => fs.readFileSync(path.join(root, 'src', f), 'utf8');
const js = ['3a-data-art.js', '3b-engine-theme.js', '3c-app.js', '3d-events.js'].map(read).join('\n');
fs.writeFileSync(path.join(root, 'app/index.html'), read('1-head.html') + read('2-body.html') + '<script>\n' + js + '\n</script>\n</body>\n</html>\n');
console.log('renderer built');
