'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const cwd=path.join(__dirname,'..'),files=fs.readdirSync(path.join(cwd,'Frontend')).filter(file=>/-smoke\.cjs$/.test(file)).sort();
const failed=[];
for(const file of files){console.log('\nChecking '+file);const result=spawnSync(process.execPath,[path.join('Frontend',file)],{cwd,stdio:'inherit',windowsHide:true});if(result.error||result.status!==0)failed.push(file);}
console.log('\nBrowser suites: '+(files.length-failed.length)+'/'+files.length+' passed.');
if(failed.length){console.error('Failed: '+failed.join(', '));process.exitCode=1;}
