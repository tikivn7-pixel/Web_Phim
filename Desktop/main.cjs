'use strict';
const {app,BrowserWindow,Menu,dialog,shell}=require('electron');
const path=require('node:path');
const {HOME,isSite,isExternal,preferences}=require('./policy.cjs');
const smoke=process.argv.includes('--desktop-smoke');
// Smoke checks use an isolated profile and never touch real viewing history.
if(smoke)app.setPath('userData',path.join(app.getPath('temp'),'lauphim-smoke-'+process.pid));
app.setAppUserModelId('vn.lauphim.desktop');
let mainWindow;
const windows=new Set();
const alive=win=>win&&!win.isDestroyed();
function goHome(win){if(alive(win))win.loadURL(HOME).catch(()=>{});}
async function openOutside(win,url){
  if(!alive(win)||!isExternal(url))return;
  const choice=await dialog.showMessageBox(win,{type:'question',title:'Mở liên kết ngoài',message:'Mở liên kết này bằng trình duyệt?',detail:new URL(url).origin,buttons:['Hủy','Mở trình duyệt'],defaultId:0,cancelId:0});
  if(choice.response===1)await shell.openExternal(url);
}
function createWindow(url=HOME){
  const win=new BrowserWindow({title:'LauPhim',width:1440,height:940,minWidth:820,minHeight:600,backgroundColor:'#0a0b0f',icon:path.join(__dirname,'icon.png'),show:false,autoHideMenuBar:true,webPreferences:{...preferences}});
  windows.add(win);win.on('closed',()=>windows.delete(win));
  win.once('ready-to-show',()=>{if(!smoke)win.show();});
  const contents=win.webContents,session=contents.session;
  // Media playback needs no camera, microphone or filesystem access.
  session.setPermissionRequestHandler((sender,permission,callback,details)=>callback(isSite(sender.getURL())&&['fullscreen','clipboard-sanitized-write'].includes(permission)&&(!details.requestingUrl||isSite(details.requestingUrl))));
  session.setPermissionCheckHandler((sender,permission,origin)=>Boolean(sender&&isSite(sender.getURL())&&['fullscreen','clipboard-sanitized-write'].includes(permission)&&(!origin||origin===new URL(HOME).origin)));
  contents.on('will-attach-webview',event=>event.preventDefault());
  contents.on('will-navigate',(event,target)=>{if(isSite(target))return;event.preventDefault();openOutside(win,target).catch(()=>{});});
  contents.on('will-redirect',(event,target,_inPlace,isMainFrame)=>{if(isMainFrame&&!isSite(target))event.preventDefault();});
  // Provider iframe popups cannot create windows or launch applications.
  contents.setWindowOpenHandler(({url:target,referrer})=>{
    if(isSite(target)&&isSite(referrer?.url)){createWindow(target);}
    return {action:'deny'};
  });
  contents.on('did-fail-load',(_event,code,_description,failedURL,isMainFrame)=>{
    if(!isMainFrame||code===-3||!isSite(failedURL))return;
    win.loadFile(path.join(__dirname,'offline.html')).catch(()=>{});
  });
  contents.on('render-process-gone',()=>{if(alive(win))win.loadFile(path.join(__dirname,'offline.html')).catch(()=>{});});
  contents.on('page-title-updated',event=>{event.preventDefault();win.setTitle('LauPhim');});
  const navigate=direction=>{const history=contents.navigationHistory;if(direction<0&&history.canGoBack())history.goBack();if(direction>0&&history.canGoForward())history.goForward();};
  contents.on('before-input-event',(event,input)=>{
    if(input.type!=='keyDown')return;
    if(input.key==='F11'){event.preventDefault();win.setFullScreen(!win.isFullScreen());}
    if(input.alt&&['Left','ArrowLeft','Right','ArrowRight'].includes(input.key)){event.preventDefault();navigate(['Left','ArrowLeft'].includes(input.key)?-1:1);}
  });
  contents.on('context-menu',(_event,params)=>{
    const entries=[];
    if(isSite(params.linkURL))entries.push({label:'Mở trong cửa sổ LauPhim mới',click:()=>createWindow(params.linkURL)});
    if(isExternal(params.linkURL))entries.push({label:'Mở liên kết bằng trình duyệt',click:()=>openOutside(win,params.linkURL)});
    if(params.isEditable)entries.push({role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'});
    else if(params.selectionText)entries.push({role:'copy'});
    if(entries.length)Menu.buildFromTemplate(entries).popup({window:win});
  });
  win.loadURL(isSite(url)?url:HOME).catch(()=>{});
  return win;
}
function menu(){
  const current=()=>BrowserWindow.getFocusedWindow()||mainWindow;
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {label:'LauPhim',submenu:[{label:'Trang chủ',accelerator:'Alt+Home',click:()=>goHome(current())},{label:'Mở web bằng trình duyệt',click:()=>shell.openExternal(HOME)},{type:'separator'},{role:'quit',label:'Thoát'}]},
    {label:'Chỉnh sửa',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
    {label:'Hiển thị',submenu:[{role:'reload',label:'Tải lại'},{role:'forceReload',label:'Tải lại bỏ qua bộ nhớ đệm'},{type:'separator'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen',label:'Toàn màn hình'}]},
    {label:'Trợ giúp',submenu:[{label:'Thông tin ứng dụng',click:()=>dialog.showMessageBox(current(),{title:'LauPhim',message:'LauPhim '+app.getVersion(),detail:'Ứng dụng dùng chung website trên GitHub Pages. Phim cần Internet. Dữ liệu cá nhân được lưu riêng với trình duyệt. Nhấn Alt để mở menu, F11 để bật/tắt toàn màn hình.'})}]}
  ]));
}
if(!smoke&&!app.requestSingleInstanceLock())app.quit();
else{
  app.on('second-instance',()=>{if(alive(mainWindow)){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.show();mainWindow.focus();}});
  app.whenReady().then(()=>{menu();mainWindow=createWindow();});
  app.on('window-all-closed',()=>app.quit());
}
