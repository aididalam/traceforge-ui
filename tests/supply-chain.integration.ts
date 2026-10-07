// No page.route(), fixtures, or APIRequestContext writes: all scenario writes use UI controls.
import {test,expect,type Page,type BrowserContext} from "@playwright/test";
import {readFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import jsQR from "jsqr";
const manifest=process.env.TRACEFORGE_INTEGRATION_MANIFEST;
if(!manifest)throw Error("Start this suite through TRACEFORGE_TEST_UI=true npm run test:direct-claim in api/. It requires the disposable integration chain and database.");
const fixture=JSON.parse(readFileSync(manifest,"utf8"));
type Product={trackingId:string;shortCode:string;rootRouteId?:string};
type Proof={rootRouteId:string;routes:{id:string;owner:string;available:string;parent:string}[]};
const label=(page:Page,name:string)=>page.getByLabel(name,{exact:true});
const button=(page:Page,name:string)=>page.getByRole("button",{name,exact:true});
const errors:string[]=[],throttled=new WeakMap<Page,number>();let globalRetryAt=0;
function observe(page:Page){page.on("pageerror",e=>errors.push(e.message));page.on("response",r=>{if(r.status()===429){const until=Date.now()+(Number(r.headers()["retry-after"]??60)*1000)+300;throttled.set(page,until);globalRetryAt=Math.max(globalRetryAt,until);}});}
async function rateWait(page:Page){const delay=Math.max(throttled.get(page)??0,globalRetryAt)-Date.now();if(delay>0)await page.waitForTimeout(delay);}
async function dashboard(page:Page,path:string){
 // Keep normal user navigation within the real 120/minute API budget. Do not disable it.
 await page.waitForTimeout(5000);await rateWait(page);await page.goto(path);
 for(let attempt=0;attempt<3;attempt++){
  try{await expect(page.locator("[data-operator-record]")).toBeVisible({timeout:10000});return;}catch(error){if(!(throttled.get(page)!>Date.now()))throw error;await rateWait(page);await button(page,"Try again").click();}
 }throw Error("Dashboard did not recover after Retry-After");
}
async function control(path:string,body:unknown={}):Promise<Proof>{
 const r=await fetch(fixture.controlOrigin+path,{method:"POST",headers:{"Content-Type":"application/json","x-test-control":fixture.controlSecret},body:JSON.stringify(body)});
 const result=await r.json();expect(r.ok,JSON.stringify(result)).toBe(true);return result;
}
async function verify(product:Product,available:number,removed:number,extra:Record<string,unknown>={}){
 const proof=await control("/checkpoint",{trackingId:product.trackingId,available:String(available),removed:String(removed),...extra});
 product.rootRouteId??=proof.rootRouteId;return proof;
}
async function write(page:Page,name:string,suffix:string){
 for(let attempt=0;attempt<3;attempt++){
  await rateWait(page);const response=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith(suffix)&&r.request().method()==="POST");
  const target=attempt?button(page,"Check confirmation"):button(page,name);await expect(target).toBeEnabled();await target.click();
  const r=await response;if(r.status()===429){await rateWait(page);continue;}
  expect(r.status(),await r.text()).toBe(200);const result=await r.json();expect(result.status).toBe("CONFIRMED");
  expect(r.request().headers().authorization).toBeUndefined();await expect(page.getByText("Confirmed. Product history will update shortly.",{exact:true})).toBeVisible();return result;
 }throw Error("Write exhausted real rate-limit retries");
}
async function create(page:Page,name:string,id:string,quantity=1){
 await dashboard(page,"/operator/products/new");await label(page,"Product name").fill(name);await label(page,"Product / batch ID").fill(id);
 if(quantity>1){await label(page,"Batch product").check();await label(page,"Number of items").fill(String(quantity));}
 else await expect(label(page,"Number of items")).toHaveCount(0);
 await button(page,"Add field").click();await label(page,"Detail name 1").fill("Description");await label(page,"Detail value 1").fill("Browser-created product · বাংলাদেশ");await page.locator("#share-product").check();
 const product:Product=await write(page,"Add product","/products/create");
 await expect(page.getByRole("img",{name:"Product tracking QR code",exact:true})).toBeVisible();
 const pixels=await page.getByRole("img",{name:"Product tracking QR code",exact:true}).evaluate(e=>{const c=e as HTMLCanvasElement,i=c.getContext("2d")!.getImageData(0,0,c.width,c.height);return {width:i.width,height:i.height,data:Array.from(i.data)}});
 expect(jsQR(new Uint8ClampedArray(pixels.data),pixels.width,pixels.height)?.data).toBe("http://127.0.0.1:13478/s/"+product.shortCode);
 await verify(product,quantity,0);return product;
}
async function lookup(page:Page,product:Product,search?:{id:string;name:string}){
 await dashboard(page,"/operator/receive");await label(page,"Tracking ID or product / batch ID").fill(search?.id??product.shortCode);
 for(let attempt=0;attempt<3;attempt++){
  await rateWait(page);await button(page,search?"Search product / batch ID":"Find product").click();
  try{if(search){await expect(button(page,"Choose product")).toHaveCount(2,{timeout:8000});await page.getByRole("region",{name:"Matching products"}).locator("li").filter({hasText:search.name}).getByRole("button",{name:"Choose product"}).click();}
   await expect(page.locator(".receipt-preview")).toBeVisible({timeout:8000});return;
  }catch(error){if(!(throttled.get(page)!>Date.now()))throw error;await rateWait(page);}
 }throw Error("Lookup failed after Retry-After");
}
async function receive(page:Page,product:Product,source?:string,quantity=1,search?:{id:string;name:string}){
 await lookup(page,product,search);if(source){await page.locator("#source-"+source).check();await label(page,"Number of items received").fill(String(quantity));}
 else await expect(label(page,"Number of items received")).toHaveCount(0);
 await label(page,"I have physically received this product").check();return write(page,"Receive into my inventory","/receive");
}
async function remove(page:Page,product:Product,route:string|undefined,quantity:number,reason="Sold",text=""){
 await dashboard(page,"/operator/products/"+product.trackingId);
 if(route){await expect(label(page,"Your receipt")).toBeEnabled();await label(page,"Your receipt").selectOption(route);await label(page,"Number of items to remove").fill(String(quantity));}
 else await expect(label(page,"Number of items to remove")).toHaveCount(0);
 await label(page,"Reason").selectOption(reason);
 if(text)await label(page,reason==="Sold"?"Explanation (optional)":"Explanation").fill(text);
 await label(page,route?"I confirm these items should leave the supply chain":"I confirm this product should leave the supply chain").check();return write(page,"Remove from supply chain","/remove");
}
async function accessible(page:Page){expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze()).violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
test("real chain: registration, partial receipts, returns, removals, tracking and replay",async({browser},info)=>{
 errors.length=0;const contexts:BrowserContext[]=[],pages:Page[]=[];
 try{
  for(const actor of fixture.actors.slice(0,3)){
   const context=await browser.newContext(info.project.use);contexts.push(context);const page=await context.newPage();pages.push(page);observe(page);
   await rateWait(page);await page.goto("/operator/sign-in");await label(page,"Email address").fill(actor.email);
   for(let attempt=0;attempt<3;attempt++){
    await rateWait(page);await label(page,"Password").fill("Synthetic-Only-Password-2026");const response=page.waitForResponse(r=>r.url().endsWith("/operator/api/login"));await button(page,"Sign in").click();const r=await response;
    if(r.status()===429){await rateWait(page);continue;}expect(r.status()).toBe(200);await dashboard(page,"/operator");break;
   }
   expect((await context.cookies()).find(c=>c.name==="tf_operator_dev")?.httpOnly).toBe(true);
   expect(await page.evaluate(()=>({...localStorage}))).toEqual({});
  }
  const [producer,distributor,shop]=pages,id="UI-BATCH-"+randomUUID(),name=info.project.name+" browser batch";
  const single=await create(producer,"Browser single "+info.project.name,"SERIAL-"+randomUUID());
  await receive(distributor,single);await verify(single,1,0);await remove(distributor,single,undefined,1,"Damaged","Broken during delivery");await verify(single,0,1,{reasons:{Damaged:"1"}});
  await dashboard(distributor,"/operator/products/"+single.trackingId);await expect(distributor.locator(".operator-product-summary .supply-chain-status")).toHaveText("Out of supply chain");await expect(distributor.locator("h1")).not.toContainText(/sold/i);
  await expect(distributor.locator(".operator-timeline li")).toHaveCount(3);await expect(distributor.locator(".operator-timeline")).toContainText("Broken during delivery");
  const batch=await create(producer,name,id,1000000),duplicate=await create(producer,"Other match "+info.project.name,id,2);
  expect(batch.trackingId).not.toBe(duplicate.trackingId);expect(batch.shortCode).not.toBe(duplicate.shortCode);
  const d=await receive(distributor,batch,batch.rootRouteId,600000,{id,name});await verify(batch,1000000,0,{owned:{0:400000,1:600000}});
  const s=await receive(shop,batch,batch.rootRouteId,400000);await verify(batch,1000000,0,{owned:{0:0,1:600000,2:400000}});
  const s2=await receive(shop,batch,d.receivedRouteId,250000);await verify(batch,1000000,0,{owned:{1:350000,2:650000}});
  const back=await receive(producer,batch,s2.receivedRouteId,50000);await verify(batch,1000000,0,{owned:{0:50000,1:350000,2:600000}});
  const d2=await receive(distributor,batch,s.receivedRouteId,100000);await verify(batch,1000000,0,{owned:{0:50000,1:450000,2:500000}});
  await lookup(shop,batch);await expect(shop.locator("#source-"+s.receivedRouteId)).toBeDisabled();
  await shop.locator("#source-"+d.receivedRouteId).check();await label(shop,"Number of items received").fill("350001");await label(shop,"I have physically received this product").check();await expect(button(shop,"Receive into my inventory")).toBeDisabled();await accessible(shop);
  await remove(shop,batch,s.receivedRouteId,100000);await verify(batch,900000,100000,{reasons:{Sold:100000}});
  await remove(shop,batch,s2.receivedRouteId,200,"Lost","পরিবহনের সময় হারিয়েছে");await verify(batch,899800,100200,{reasons:{Sold:100000,Lost:200}});
  await remove(distributor,batch,d2.receivedRouteId,500,"Spoiled","Packaging damaged during storage");await verify(batch,899300,100700,{owned:{0:50000,1:449500,2:399800},reasons:{Sold:100000,Lost:200,Spoiled:500}});
  await dashboard(distributor,"/operator/products/"+batch.trackingId);await expect(distributor.getByText("899,300 out of 1,000,000 available",{exact:true})).toBeVisible();await expect(distributor.getByText("449,500 available",{exact:true})).toBeVisible();await expect(label(distributor,"Your receipt").locator("option")).toHaveCount(3);await accessible(distributor);await distributor.screenshot({path:info.outputPath("real-batch-inventory.png"),fullPage:true});
  await expect(distributor.locator(".operator-timeline")).toContainText("পরিবহনের সময় হারিয়েছে");
  const publicContext=await browser.newContext(info.project.use);contexts.push(publicContext);await publicContext.addCookies([{name:"tf_operator_dev",value:"synthetic-only",domain:"127.0.0.1",path:"/"}]);const publicPage=await publicContext.newPage();observe(publicPage);
  const publicRequests:{method:string;cookie:boolean;auth:boolean}[]=[];publicPage.on("request",r=>{if(new URL(r.url()).pathname.startsWith("/public/"))publicRequests.push({method:r.method(),cookie:!!r.headers().cookie,auth:!!r.headers().authorization});});
  await publicPage.goto("/");await label(publicPage,"Tracking ID or product / batch ID").fill(id);await button(publicPage,"Search product / batch ID").click();await expect(button(publicPage,"Choose product")).toHaveCount(2);
  await publicPage.getByRole("region",{name:"Matching products"}).locator("li").filter({hasText:name}).getByRole("button",{name:"Choose product"}).click();await expect(publicPage.getByText("899,300 out of 1,000,000 available",{exact:true})).toBeVisible();
  const holders=publicPage.getByRole("region",{name:"Businesses holding this batch"});for(const actor of fixture.actors.slice(0,3))await expect(holders).toContainText(actor.name);
  await expect(holders).toContainText("449,500 available · 2 receipts");await button(publicPage,"View available receipts").click();await label(publicPage,"Receipt to inspect").selectOption(d2.receivedRouteId);await expect(publicPage.getByRole("region",{name:"Available batch receipts"})).toContainText("From Test Shop");await accessible(publicPage);await publicPage.screenshot({path:info.outputPath("real-public-batch.png"),fullPage:true});
  expect(publicRequests.length).toBeGreaterThan(0);expect(publicRequests.every(r=>r.method==="GET"&&!r.cookie&&!r.auth)).toBe(true);
  await lookup(distributor,fixture.privateProduct);await expect(distributor.locator(".receipt-preview")).toContainText("Product details not shared");await expect(distributor.locator("body")).not.toContainText("PRIVATE_BROWSER_SENTINEL");
  await publicPage.goto("/s/"+fixture.privateProduct.shortCode);await expect(publicPage.getByRole("heading",{name:"Product history unavailable"})).toBeVisible();await expect(publicPage.locator("[data-public-record]")).toHaveCount(0);await expect(publicPage.locator("body")).not.toContainText("Private browser product");
  await publicPage.goto("/s/"+fixture.paginated.shortCode);await expect(publicPage.locator(".timeline-event")).toHaveCount(50);
  const nextPage=publicPage.waitForResponse(r=>{const url=new URL(r.url()),after=url.searchParams.get("afterEventId");return url.pathname.endsWith("/history")&&after!==null&&after!=="0";});
  await button(publicPage,"Show more updates").click();const nextResponse=await nextPage;expect(BigInt(new URL(nextResponse.url()).searchParams.get("afterEventId")!)).toBeGreaterThan(9007199254740991n);
  await expect(publicPage.locator(".timeline-event")).toHaveCount(56);await expect(button(publicPage,"Show more updates")).toHaveCount(0);
  const refs=await publicPage.locator(".timeline-event").evaluateAll(items=>items.map(e=>e.textContent));expect(new Set(refs).size).toBe(56);
  await dashboard(producer,"/operator/products/"+fixture.paginated.trackingId);await expect(producer.locator(".operator-timeline li")).toHaveCount(50);await button(producer,"Show more updates").click();await expect(producer.locator(".operator-timeline li")).toHaveCount(56);
  await remove(producer,batch,back.receivedRouteId,49999);let proof=await verify(batch,849301,150699);
  for(const route of proof.routes.filter(r=>r.id!==back.receivedRouteId&&BigInt(r.available)>0n)){
   const index=fixture.actors.findIndex((a:{organizationId:string})=>a.organizationId===route.owner);await remove(pages[index],batch,route.id,Number(route.available));
   proof=await verify(batch,Number(proof.routes.filter(r=>r.id!==route.id).reduce((n,r)=>n+BigInt(r.available),0n)),1000000-Number(proof.routes.filter(r=>r.id!==route.id).reduce((n,r)=>n+BigInt(r.available),0n)));
  }
  await dashboard(producer,"/operator/products/"+batch.trackingId);await expect(producer.getByText("1 out of 1,000,000 available",{exact:true})).toBeVisible();await expect(producer.getByRole("heading",{name:"Batch availability",exact:true})).toBeVisible();await expect(producer.locator(".operator-product-summary .supply-chain-status")).toHaveText("In supply chain");
  await remove(producer,batch,back.receivedRouteId,1);await verify(batch,0,1000000);await dashboard(producer,"/operator/products/"+batch.trackingId);await expect(producer.locator(".operator-product-summary .supply-chain-status")).toHaveText("Out of supply chain");await expect(button(producer,"Remove from supply chain")).toHaveCount(0);
  await lookup(distributor,batch);await expect(button(distributor,"Receive into my inventory")).toHaveCount(0);
  expect(await control("/rebuild")).toMatchObject({equal:true,tables:5});expect(errors).toEqual([]);
 }finally{for(const context of contexts)await context.close();}
});
