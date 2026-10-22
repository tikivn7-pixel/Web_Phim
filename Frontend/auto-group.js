#!/usr/bin/env node
// Compatibility command: title similarity is never evidence of a relationship.
const {deriveRelations}=require('./build-relations');
const {readMovies}=require('./catalog-tools');
const fs=require('fs'),path=require('path');
if(process.argv.includes('--write'))require('./build-catalog').buildCatalog();
else {
  const read=name=>{const file=path.join(__dirname,'../Backend',name);return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};};
  const registry=deriveRelations(readMovies(),read('relations-cache.json'),read('movie-relations.manual.json'));
  console.log(`${registry.groups.length} verified groups. Run with --write to export. No title matching.`);
}
