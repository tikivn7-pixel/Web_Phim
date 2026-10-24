(function(root){
  'use strict';let entries=[],pending=null;
  function normalize(input){return(Array.isArray(input?.overrides)?input.overrides:[]).slice(0,5000).filter(row=>row&&typeof row.slug==='string'&&row.slug.length<=250&&!['__proto__','constructor','prototype'].includes(row.slug)&&row.movie?.slug===row.slug&&typeof row.movie.title==='string'&&Number.isInteger(row.revision)).map(row=>({slug:row.slug,movie:row.movie,revision:row.revision,updatedAt:row.updatedAt}));}
  function apply(movie){const row=entries.find(row=>row.slug===movie?.slug);return row?{...movie,...row.movie,updatedAt:new Date(row.updatedAt).toISOString()}:movie;}
  function overlay(movies){const result=(Array.isArray(movies)?movies:[]).map(apply),known=new Set(result.map(m=>m.slug));for(const row of entries)if(!known.has(row.slug)){known.add(row.slug);result.push({...row.movie,updatedAt:new Date(row.updatedAt).toISOString()});}return result;}
  function load({force=false}={}){if(!root.HubClient?.configured())return Promise.resolve([]);if(!pending||force)pending=HubClient.request('/catalog/overrides',{timeout:5000}).then(value=>{entries=normalize(value);return entries;}).catch(()=>entries);return pending;}
  root.HubCatalog={normalize,apply,overlay,load};
})(globalThis);
