'use strict';
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const cwd=path.join(__dirname,'..');
const args=process.argv.slice(2);
if(args.includes('--help')||args.includes('-h')){
  console.log('npm run push                    Add all changes, commit and push.\nnpm run push -- "Sua logo"       Use a custom commit message.\nIncludes all changes in this project except files excluded by .gitignore.');
  process.exit(0);
}
function git(args,capture=false){
  const result=spawnSync('git',args,{cwd,stdio:capture?'pipe':'inherit',encoding:'utf8',windowsHide:true});
  if(result.error)throw result.error;
  if(result.signal||result.status===null)throw Error('Git was interrupted.');
  return result;
}
function required(args){const result=git(args);if(result.status!==0)process.exit(result.status);}
try{
  const branch=git(['symbolic-ref','--quiet','--short','HEAD'],true);
  if(branch.status!==0)throw Error('Select a branch before committing and pushing.');
  required(['remote','get-url','origin']);
  // Stamp changed HTML/assets before committing, so web and desktop clients
  // see the same published release and do not reuse stale asset URLs.
  const release=require('./build-release.cjs').buildRelease();
  console.log('Web/app release: '+release.version.slice(0,16));
  required(['add','--all','.']);
  const staged=git(['diff','--cached','--quiet'],true);
  if(staged.status===1){
    const stamp=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date());
    required(['commit','-m',args.join(' ').trim()||'Cap nhat web '+stamp]);
  }else if(staged.status===0){console.log('No new changes to commit; pushing existing commits.');}
  else{throw Error(staged.stderr||'Unable to check staged changes.');}
  required(['push','--set-upstream','origin',branch.stdout.trim()]);
}catch(error){console.error(error.message);process.exitCode=1;}
