import game from './server-game.js';
const DB_URL=Deno.env.get('SUPABASE_URL')!;
const KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const origins=new Set(['https://anzosafe-oss.github.io']);
async function rest(params:string,method='GET',body?:object){
 const r=await fetch(DB_URL+'/rest/v1/avioanele_rooms?'+params,{method,headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json',Prefer:'return=representation'},body:body?JSON.stringify(body):undefined});
 if(!r.ok){console.error('Database request failed',r.status);throw Error('Serviciul nu este disponibil momentan. Reîncearcă.');}
 return r.status===204?[]:await r.json();
}
const env={DB:{prepare(sql:string){return {bind(...a:unknown[]){return {
 async first(){const rows=await rest('select=code,data,revision&code=eq.'+encodeURIComponent(String(a[0]))+'&updated_at=gt.'+(Date.now()-86400000));return rows[0]||null},
 async run(){
  if(sql.startsWith('INSERT')){await rest('updated_at=lt.'+(Date.now()-86400000),'DELETE');await rest('','POST',{code:a[0],data:a[1],updated_at:a[2]});return {meta:{changes:1}};}
  const rows=await rest('code=eq.'+encodeURIComponent(String(a[2]))+'&revision=eq.'+a[3],'PATCH',{data:a[0],updated_at:a[1],revision:Number(a[3])+1});return {meta:{changes:rows.length}};
 }
}}}}}};
const limits=new Map<string,{count:number,until:number}>();
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 const cors={'Access-Control-Allow-Origin':origins.has(origin)?origin:'https://anzosafe-oss.github.io','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'content-type, apikey, authorization','Vary':'Origin','Cache-Control':'no-store'};
 if(origin&&!origins.has(origin))return new Response('Origin not allowed',{status:403});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return new Response('Method not allowed',{status:405,headers:cors});
 const action=new URL(req.url).pathname.split('/').pop();
 const ip=req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown';
 const now=Date.now();if(limits.size>2000)for(const [k,v] of limits)if(v.until<now)limits.delete(k);
 const rateKey=ip+':'+(action==='create'?'create':'all');let rate=limits.get(rateKey);if(!rate||rate.until<now){rate={count:0,until:now+60000};limits.set(rateKey,rate)}
 if(++rate.count>(action==='create'?10:180))return Response.json({error:'Prea multe cereri. Încearcă peste un minut.'},{status:429,headers:cors});
 try{
  const body=await req.text();if(body.length>10000)return Response.json({error:'Cerere prea mare.'},{status:413,headers:cors});
  const response=await game.fetch(new Request('https://game.internal/api/'+action,{method:'POST',body,headers:{'Content-Type':'application/json'}}),env);
  return new Response(response.body,{status:response.status,headers:{...Object.fromEntries(response.headers),...cors}});
 }catch{ return Response.json({error:'Serviciul nu este disponibil momentan. Reîncearcă.'},{status:503,headers:cors})}
});
