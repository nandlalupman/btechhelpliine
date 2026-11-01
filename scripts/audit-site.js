const fs = require('fs');
const path = require('path');
const decode = value => value.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)));
const withoutScripts = html => html.replace(/<script\b([^>]*)>[\s\S]*?<\/script>/gi, '<script$1></script>').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'');
function references(html) {
  const clean = withoutScripts(html), refs = [], ids = new Set();
  for (const match of clean.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)) ids.add(decode(match[1]));
  for (const match of clean.matchAll(/<(a|img|script|link|form|source)\b([^>]*)>/gi)) {
    const [, tag, attrs] = match;
    if (tag.toLowerCase()==='link' && !/\brel\s*=\s*["'](?:stylesheet|icon|preload)["']/i.test(attrs)) continue;
    const attr = ['a','link'].includes(tag.toLowerCase()) ? 'href' : tag.toLowerCase()==='form' ? 'action' : 'src';
    const found = attrs.match(new RegExp(`\\b${attr}\\s*=\\s*["']([^"']*)["']`,'i'));
    if (found?.[1]) refs.push({ value:decode(found[1]), kind:tag.toLowerCase() });
  }
  return { refs, ids };
}
async function audit(base, { output } = {}) {
  const root = new URL(base), pages = new Set(['/', '/login','/register','/forgot-password','/reset-password','/dashboard','/admin','/counsellor','/onboard','/privacy','/terms','/shortlist/','/compare/','/applications/','/appointments/','/messages/','/inbox/','/staff/']);
  const cache = new Map(), internal = new Map(), external = new Map(), issues = [];
  async function get(url) {
    const key = url.origin + url.pathname + url.search;
    if (!cache.has(key)) cache.set(key,(async()=>{
      try { const response = await fetch(key,{ headers:{Connection:'close'},signal:AbortSignal.timeout(15000) }); const type=response.headers.get('content-type')||''; const body = /text\/html|xml/.test(type) ? await response.text() : (await response.arrayBuffer(), ''); return { status:response.status,type,body,url:response.url }; }
      catch(error) { return {status:0,type:'',body:'',error:error.cause?.code||error.name}; }
    })());
    return cache.get(key);
  }
  const sitemap = await get(new URL('/sitemap.xml',root));
  if(sitemap.status!==200) issues.push({type:'sitemap',status:sitemap.status});
  for(const match of sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)) pages.add(new URL(decode(match[1])).pathname);
  async function checkPage(page) {
    const url = new URL(page,root), result = await get(url);
    if(result.status!==200 || !/text\/html/.test(result.type)) { issues.push({type:'page',page,status:result.status,error:result.error}); return; }
    const {refs}=references(result.body);
    for(const ref of refs) {
      if(!ref.value || ref.value==='#' || /^(mailto:|tel:|javascript:|data:)/i.test(ref.value)) continue;
      let target; try {target=new URL(ref.value,url);}catch{issues.push({type:'invalid-link',page,target:ref.value});continue;}
      if(!['https:','http:'].includes(target.protocol)) continue;
      const own = target.origin===root.origin || ['www.btechhelpline.com','btechhelpline.com'].includes(target.hostname) || (['localhost','127.0.0.1'].includes(target.hostname) && target.port===root.port);
      if(!own) { if(!external.has(target.href)) external.set(target.href,{url:target.href,sources:[]}); const row=external.get(target.href); if(row.sources.length<3) row.sources.push(page); continue; }
      target=new URL(target.pathname+target.search+target.hash,root);
      if(target.pathname.startsWith('/api/')) continue;
      const key=target.href;
      if(!internal.has(key)) internal.set(key,{url:target,sources:[],kind:ref.kind});
      const row=internal.get(key); if(row.sources.length<3&&!row.sources.includes(page))row.sources.push(page);
    }
  }
  let queue=[...pages], index=0;
  await Promise.all(Array.from({length:5},async()=>{while(index<queue.length)await checkPage(queue[index++]);}));
  queue=[...internal.values()]; index=0;
  await Promise.all(Array.from({length:5},async()=>{
    while(index<queue.length){
      const item=queue[index++], result=await get(item.url);
      if(result.status!==200) {issues.push({type:'internal-link',target:item.url.pathname+item.url.search,status:result.status,sources:item.sources});continue;}
      if(item.url.hash&&/text\/html/.test(result.type)){
        let anchor;try{anchor=decodeURIComponent(item.url.hash.slice(1));}catch{anchor=item.url.hash.slice(1);}
        if(!references(result.body).ids.has(anchor))issues.push({type:'anchor',target:item.url.pathname+item.url.hash,sources:item.sources});
      }
      if(['script','link'].includes(item.kind)&&/text\/html/.test(result.type))issues.push({type:'asset-content',target:item.url.pathname,sources:item.sources});
    }
  }));
  const report={checkedAt:new Date().toISOString(),base:root.origin,pages:pages.size,internalLinks:internal.size,requests:cache.size,externalLinks:external.size,issues,external:[...external.values()]};
  if(output){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));}
  return report;
}
module.exports={audit,references};
if(require.main===module) audit(process.env.AUDIT_URL||'http://127.0.0.1:4173',{output:path.join(__dirname,'../.local/site-audit.json')}).then(report=>{console.log(JSON.stringify({pages:report.pages,internalLinks:report.internalLinks,issues:report.issues},null,2));if(report.issues.length)process.exitCode=1;}).catch(error=>{console.error(error.message);process.exitCode=1;});
