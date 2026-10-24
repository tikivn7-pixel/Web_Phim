(function(root){
  'use strict';
  const ENDPOINT='hub_endpoint_v1',SESSION='hub_session_v1';let healthy=false,healthPromise=null;
  function cleanEndpoint(value){const url=new URL(String(value||root.location.origin));if(url.username||url.password||url.search||url.hash||!['https:','http:'].includes(url.protocol)||url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('Dùng URL HTTPS của dịch vụ; HTTP chỉ dùng cho localhost.');url.pathname=url.pathname.replace(/\/+$/,'').replace(/\/api\/hub$/,'')+'/api/hub';return url.href.replace(/\/$/,'');}
  function saved(){try{return root.localStorage.getItem(ENDPOINT)||'';}catch(_){return '';}}
  function baseURL(){return cleanEndpoint(saved()||root.location.origin);}
  function session(){try{const state=JSON.parse(root.sessionStorage.getItem(SESSION)||'null');return state?.endpoint===baseURL()&&typeof state.token==='string'&&state.user?.id?state:null;}catch(_){return null;}}
  function setSession(result){root.sessionStorage.setItem(SESSION,JSON.stringify({token:result.token,user:result.user,endpoint:baseURL()}));root.dispatchEvent(new Event('hub-auth-change'));}
  function clearSession(){try{root.sessionStorage.removeItem(SESSION);}catch(_){}root.dispatchEvent(new Event('hub-auth-change'));}
  async function request(path,options={}){
    if(path.length>2048||!/^\/[a-zA-Z0-9_/?=&%.:+-]*$/.test(path)||path.startsWith('//')||path.includes('..'))throw Error('Đường dẫn dịch vụ không hợp lệ.');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),options.timeout||10000),headers={Accept:'application/json',...options.headers};if(options.auth){const user=session();if(!user)throw Error('Đăng nhập để dùng tính năng này.');headers.Authorization='Bearer '+user.token;}if(options.body!==undefined)headers['Content-Type']='application/json';
    try{const response=await root.fetch(baseURL()+path,{method:options.method||'GET',headers,body:options.body===undefined?undefined:JSON.stringify(options.body),signal:controller.signal,credentials:'omit',cache:'no-store',redirect:'error'});let result;try{result=await response.json();}catch(_){throw Error('Dịch vụ chưa trả dữ liệu hợp lệ. Kiểm tra URL kết nối.');}if(!response.ok){const error=Error(result.message||result.error||'Dịch vụ trả lỗi '+response.status);error.status=response.status;error.data=result;if(options.auth&&response.status===401)clearSession();throw error;}healthy=true;return result;}catch(error){if(error.name==='AbortError')throw Error('Dịch vụ phản hồi quá lâu. Dữ liệu trên thiết bị vẫn được giữ.');throw error;}finally{clearTimeout(timer);}
  }
  async function ready(){if(!healthPromise)healthPromise=request('/health',{timeout:4000}).then(()=>true).catch(()=>{healthy=false;healthPromise=null;return false;});return healthPromise;}
  const api={ENDPOINT,SESSION,cleanEndpoint,baseURL,session,setSession,clearSession,request,ready,configured:()=>!!saved()||healthy,configure(value){const endpoint=cleanEndpoint(value);if(endpoint!==baseURL())clearSession();root.localStorage.setItem(ENDPOINT,endpoint);healthy=false;healthPromise=null;root.dispatchEvent(new Event('hub-config-change'));return endpoint;}};
  root.HubClient=api;
})(globalThis);
