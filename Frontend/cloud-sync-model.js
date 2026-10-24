(function(root){
  'use strict';const P=typeof module!=='undefined'&&module.exports?require('./personal-data'):root.PersonalData;
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  function reconcile(base,local,remote){
    const b=P.normalize(base),l=P.normalize(local),r=P.normalize(remote);if(same(l,b))return r;if(same(r,b))return l;
    const out=P.merge(l,r);
    // A removal observed relative to the last successful common snapshot wins
    // over a stale copy. New additions from either device remain present.
    for(const key of ['my_wishlist','continue_watching_list']){const old=new Set(b[key].map(m=>m.slug)),left=new Set(l[key].map(m=>m.slug)),right=new Set(r[key].map(m=>m.slug));out[key]=out[key].filter(m=>!old.has(m.slug)||left.has(m.slug)&&right.has(m.slug));}
    for(const [slug,episodes]of Object.entries(b.episode_positions)){if(!Object.hasOwn(l.episode_positions,slug)||!Object.hasOwn(r.episode_positions,slug)){delete out.episode_positions[slug];continue;}for(const key of Object.keys(episodes))if(!Object.hasOwn(l.episode_positions[slug],key)||!Object.hasOwn(r.episode_positions[slug],key))delete out.episode_positions[slug]?.[key];}
    for(const key of ['player_preferences_v1','autonext_enabled','audio_boost']){const value=same(l[key],b[key])?r[key]:l[key];if(value===undefined)delete out[key];else out[key]=value;}
    return P.normalize(out);
  }
  const api={same,reconcile};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CloudSyncModel=api;
})(globalThis);
