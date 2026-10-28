// Generate a complete static homepage fallback from the same server-rendered view.
const fs = require('fs');
const path = require('path');
const { publicCollege } = require('../server/services/catalogue');
const { renderHome } = require('../server/views/site');
const directory = require('../server/data/directory.json');
fs.writeFileSync(path.join(__dirname, '../public/index.html'), renderHome(directory.map(publicCollege)));
console.log('Generated public/index.html from the shared homepage view.');
