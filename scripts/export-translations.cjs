// Run after editing assets/i18n.js to keep the reference CSV in sync.
const fs=require('node:fs');
const path=require('node:path');
const table=require('../assets/i18n.js');
const cell=value=>'"'+String(value).replaceAll('"','""')+'"';
const csv=[['key','ko','en'],...Object.entries(table).map(([key,v])=>[key,v.ko,v.en])].map(row=>row.map(cell).join(',')).join('\r\n');
fs.writeFileSync(path.join(__dirname,'..','language-table.csv'),'\ufeff'+csv);
console.log('language-table.csv: '+Object.keys(table).length+' translation pairs');
