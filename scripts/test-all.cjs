'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const cwd=path.join(__dirname,'..'),files=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(entry.name.startsWith('.')||entry.name==='node_modules')continue;const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(/\.test\.(?:js|cjs)$/.test(entry.name))files.push(path.relative(cwd,file));}}
for(const dir of ['Frontend','Backend','Desktop','scripts'])walk(path.join(cwd,dir));
if(!files.length)throw Error('No test files discovered.');
console.log('Running '+files.length+' test files across web, backend, desktop and maintenance scripts.');
const result=spawnSync(process.execPath,['--test',...process.argv.slice(2),...files.sort()],{cwd,stdio:'inherit',windowsHide:true});
if(result.error)throw result.error;process.exitCode=result.status??1;
