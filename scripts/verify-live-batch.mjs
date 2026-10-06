// Read-only acceptance against the actual activated Next.js/API/Pi deployment.
import assert from "node:assert/strict";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {homedir} from "node:os";
import {chromium,devices,expect} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const origin=process.env.TRACEFORGE_LIVE_UI_ORIGIN??"http://127.0.0.1:3101";
assert.equal(new URL(origin).hostname,"127.0.0.1");
const report=JSON.parse(await readFile("../contracts/deployments/9009/operations/batch-demo.json","utf8"));
const credentialFile=process.env.TRACEFORGE_DEMO_ACCOUNTS_FILE??resolve(homedir(),".traceforge/secrets/batch-demo-accounts.json");
const credentials=JSON.parse(await readFile(credentialFile,"utf8"));
const batch=report.products.find(p=>p.trackingId===report.batchProduct),single=report.products.find(p=>p.trackingId===report.claimableProduct),closed=report.products.find(p=>!p.isBatch&&p.closed),privateProduct=report.products.find(p=>!p.publish);
const dir="/private/tmp/traceforge-phase6-ui";await mkdir(dir,{recursive:true,mode:0o700});
const browser=await chromium.launch(),checks=[];
try{
 for(const [profile,options] of [["desktop",{viewport:{width:1440,height:1100}}],["mobile",devices["Pixel 7"]]]){
  const context=await browser.newContext({...options,baseURL:origin,serviceWorkers:"block"}),page=await context.newPage(),errors=[],writes=[];
  page.on("pageerror",error=>errors.push(error.message));page.on("request",r=>{if(r.method()!=="GET"&&new URL(r.url()).pathname.startsWith("/operator/api/products/"))writes.push(new URL(r.url()).pathname);});
  await page.goto("/s/"+batch.shortCode);await expect(page.getByText("899,300 out of 1,000,000 available",{exact:true})).toBeVisible();
  await expect(page.getByRole("heading",{name:batch.name,exact:true})).toBeVisible();
  const holders=page.getByRole("region",{name:"Businesses holding this batch"});for(const business of report.businesses)await expect(holders).toContainText(business.name);
  await expect(page.locator(".reason-totals")).toContainText("Lost");await expect(page.locator(".reason-totals")).toContainText("200");await expect(page.locator(".timeline")).toContainText("পরিবহনের সময় হারিয়েছে");
  await page.getByRole("button",{name:"View available receipts",exact:true}).click();await expect(page.getByLabel("Receipt to inspect",{exact:true}).locator("option")).toHaveCount(7);
  assert.deepEqual((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze()).violations,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:resolve(dir,profile+"-public-batch.png"),fullPage:true});
  await page.goto("/s/"+single.shortCode);await expect(page.getByRole("heading",{name:single.name,exact:true})).toBeVisible();await expect(page.locator(".supply-chain-status")).toHaveText("In supply chain");
  await page.goto("/s/"+closed.shortCode);await expect(page.getByRole("heading",{name:closed.name,exact:true})).toBeVisible();await expect(page.locator(".supply-chain-status")).toHaveText("Out of supply chain");
  await page.goto("/s/"+privateProduct.shortCode);await expect(page.getByRole("heading",{name:"Product history unavailable"})).toBeVisible();assert.ok(!(await page.locator("body").innerText()).includes(privateProduct.name));
  const actor=credentials.find(a=>a.email==="distributor@traceforge.test");await page.goto("/operator/sign-in");await page.getByLabel("Email address",{exact:true}).fill(actor.email);await page.getByLabel("Password",{exact:true}).fill(actor.password);await page.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page.locator("[data-operator-record]")).toBeVisible();
  assert.equal((await context.cookies()).find(c=>c.name==="tf_operator_dev")?.httpOnly,true);
  await page.goto("/operator/products/"+batch.trackingId);await expect(page.getByText("899,300 out of 1,000,000 available",{exact:true})).toBeVisible();await expect(page.getByText("249,500 available",{exact:true})).toBeVisible();
  await page.goto("/operator/receive");await page.getByLabel("Tracking ID or product / batch ID",{exact:true}).fill(single.shortCode);await page.getByRole("button",{name:"Find product",exact:true}).click();await expect(page.locator(".receipt-preview")).toContainText(single.name);await page.getByLabel("I have physically received this product",{exact:true}).check();await expect(page.getByRole("button",{name:"Receive into my inventory",exact:true})).toBeEnabled();
  assert.deepEqual((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze()).violations,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:resolve(dir,profile+"-claimable-single.png"),fullPage:true});
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);const menu=page.getByRole("button",{name:"Show menu",exact:true});if(await menu.isVisible())await menu.click();await page.getByRole("button",{name:"Sign out",exact:true}).click();await context.close();checks.push({profile,passed:true,publicBatch:true,ownStock:true,claimableSingle:true,closedSingle:true,privateLookup:true,accessibility:true,noProductWrites:true,pageErrors:0});
 }
 const result={passed:true,origin,checks};await writeFile(resolve(dir,"evidence.json"),JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
