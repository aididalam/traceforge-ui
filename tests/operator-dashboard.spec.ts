import { test,expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import jsQR from "jsqr";
import { operatorUser,operatorProduct,operatorProducts,operatorBusinesses,operatorHistory,operatorOperations } from "./operator-fixtures";
async function showBusinessMenu(page:import("@playwright/test").Page){
 const toggle=page.getByRole("button",{name:"Show menu",exact:true});
 if(await toggle.isVisible())await toggle.click();
}
async function navigateBusiness(page:import("@playwright/test").Page,label:string){
 await showBusinessMenu(page);
 await page.getByRole("navigation",{name:"Business dashboard"}).getByRole("link",{name:label,exact:true}).click();
}
async function signIn(page:import("@playwright/test").Page){
 await page.goto("/operator/sign-in");await page.getByLabel("Email address",{exact:true}).fill(operatorUser.email);
 await page.getByLabel("Password",{exact:true}).fill("Synthetic-Only-Password-2026");await page.getByRole("button",{name:"Sign in",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Business dashboard",exact:true})).toBeVisible();
 await expect(page.getByRole("link",{name:"Garden Tea Batch 001"})).toBeVisible();
}
async function openAddProduct(page:import("@playwright/test").Page){
 await signIn(page);
 await expect(page.locator(".operator-stats")).toBeVisible();
 await expect(page.getByLabel("Product name",{exact:true})).toHaveCount(0);
 await navigateBusiness(page,"Products");
 await expect(page.getByRole("heading",{name:"Products",exact:true})).toBeVisible();
 await expect(page.getByLabel("Product name",{exact:true})).toHaveCount(0);
 await page.getByRole("link",{name:"Add product",exact:true}).click();
 await expect(page).toHaveURL(/\/operator\/products\/new$/);
 await expect(page.getByRole("heading",{name:"Add a product",exact:true})).toBeVisible();
 await page.getByLabel("Product / batch ID",{exact:true}).fill("TEST-001");
 await showBusinessMenu(page);
 await expect(page.getByRole("navigation",{name:"Business dashboard"}).getByRole("link",{name:"Products",exact:true})).toHaveAttribute("aria-current","page");
}
test("a business registers independently with its own type and no invitation",async({page},testInfo)=>{
 await page.goto("/operator/sign-in");await page.getByRole("button",{name:"Register a business",exact:true}).click();
 await page.getByLabel("Your name",{exact:true}).fill("Demo Operator");
 await page.getByLabel("Business name",{exact:true}).fill("Independent Distributor");
 await page.getByRole("combobox",{name:"Business type",exact:true}).fill("Customs broker & inspection");
 await page.getByRole("option",{name:"Use “Customs broker & inspection”",exact:true}).click();
 await page.getByLabel("Email address",{exact:true}).fill(operatorUser.email);
 await page.getByLabel("Password",{exact:true}).fill("Synthetic-Only-Password-2026");
 await expect(page.getByLabel("Invitation code",{exact:true})).toHaveCount(0);
 await page.getByLabel("Show my business name in public product history",{exact:true}).check();
 expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze()).violations).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath("register-business.png"),fullPage:true});
 const sent=page.waitForRequest(request=>request.url().endsWith("/signup")&&request.method()==="POST");
 await page.getByRole("button",{name:"Register business",exact:true}).click();
 expect((await sent).postDataJSON()).toMatchObject({businessType:"Customs broker & inspection",publicProfile:true});
 await expect(page.getByText("Your business account is ready. Sign in with your email and password.")).toBeVisible();
 await expect(page.getByLabel("Password",{exact:true})).toHaveValue("");
 expect(await page.evaluate(()=>[localStorage.length,sessionStorage.length])).toEqual([0,0]);
});
test("receipt requires physical confirmation and uses a fixed authenticated write",async({page})=>{
 await signIn(page);await navigateBusiness(page,"Receive a product");
 await page.getByLabel("Tracking ID or product / batch ID",{exact:true}).fill(operatorProduct.id);
 await page.getByRole("button",{name:"Find product",exact:true}).click();
 const receive=page.getByRole("button",{name:"Request to receive",exact:true});
 await expect(receive).toBeDisabled();
 await page.getByLabel("I have physically received this product",{exact:true}).check();
 const sent=page.waitForRequest(request=>request.url().endsWith("/receive")&&request.method()==="POST");
 await receive.click();const request=await sent;
 expect(request.postDataJSON()).toMatchObject({version:"1",confirmed:true});expect(request.headers().authorization).toBeUndefined();
 await expect(page.getByRole("status").filter({hasText:"Awaiting the current owner"})).toBeVisible();
 await expect(receive).toHaveCount(0);
});
test("a produced product has a decodable Tracking ID QR, and the holder can close it with a reason",async({page})=>{
 await openAddProduct(page);await page.getByLabel("Product name",{exact:true}).fill("New Tea Pack");
 await expect(page.locator("#product-description")).toHaveCount(0);
 await page.getByRole("button",{name:"Add field",exact:true}).click();
 await page.getByLabel("Detail name 1",{exact:true}).fill("Description");
 await page.getByLabel("Detail value 1",{exact:true}).fill("Product details for the printed tracking record.");
 await page.getByRole("button",{name:"Add product",exact:true}).click();
 const qr=page.getByRole("img",{name:"Product tracking QR code",exact:true});await expect(qr).toBeVisible();
 const pixels=await qr.evaluate((element)=>{const canvas=element as HTMLCanvasElement;const image=canvas.getContext("2d")!.getImageData(0,0,canvas.width,canvas.height);return {width:image.width,height:image.height,data:Array.from(image.data)};});
 expect(jsQR(new Uint8ClampedArray(pixels.data),pixels.width,pixels.height)?.data).toBe("http://127.0.0.1:4178/s/abc123xyz789");
 await page.getByRole("link",{name:"View product",exact:true}).click();
 await page.getByLabel("Reason",{exact:true}).selectOption("Damaged");
 const close=page.getByRole("button",{name:"Remove from supply chain",exact:true});await expect(close).toBeDisabled();
 await page.getByLabel("I confirm this product should leave the supply chain",{exact:true}).check();
 const sent=page.waitForRequest(request=>request.url().endsWith("/close")&&request.method()==="POST");
 await close.click();expect((await sent).postDataJSON()).toMatchObject({reason:"Damaged",confirmed:true});
 await expect(page.getByText("Confirmed. Product history will update shortly.",{exact:true})).toBeVisible();await expect(close).toBeDisabled();
});
test("operators add and remove custom fields, save JSON and see exact values in product details",async({page})=>{
 await openAddProduct(page);await page.getByLabel("Product name",{exact:true}).fill("Custom product");
 await page.getByRole("button",{name:"Add field",exact:true}).click();
 await page.getByLabel("Detail name 1",{exact:true}).fill("Batch number");await page.getByLabel("Detail value 1",{exact:true}).fill("BATCH-2026-001");
 await page.getByRole("button",{name:"Add field",exact:true}).click();
 await page.getByLabel("Detail name 2",{exact:true}).fill("Ingredients");await page.getByLabel("Detail value 2",{exact:true}).fill("Water, Sugar\n500mL · বাংলাদেশ <b>plain text</b>");
 await expect(page.getByLabel("Detail value 1",{exact:true})).toHaveValue("BATCH-2026-001");
 await expect(page.getByLabel("Detail value 2",{exact:true})).toHaveValue("Water, Sugar\n500mL · বাংলাদেশ <b>plain text</b>");
 await page.getByRole("button",{name:"Add field",exact:true}).click();await page.getByRole("button",{name:"Remove field 3",exact:true}).click();
 await expect(page.getByLabel("Detail name 3",{exact:true})).toHaveCount(0);
 await page.getByLabel(/Share this product's details/).check();
 expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze()).violations).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const sent=page.waitForRequest(request=>request.url().endsWith("/products/create")&&request.method()==="POST");
 await page.getByRole("button",{name:"Add product",exact:true}).click();
 const fields=[{label:"Batch number",value:"BATCH-2026-001"},{label:"Ingredients",value:"Water, Sugar\n500mL · বাংলাদেশ <b>plain text</b>"}];
 expect((await sent).postDataJSON()).toMatchObject({fields,publish:true,id:"TEST-001",quantity:1});
 await page.route("**/operator/api/products/"+operatorProduct.id+"/history?*",route=>route.fulfill({json:{...operatorHistory,product:{...operatorProduct,fields}}}));
 await page.getByRole("link",{name:"View product",exact:true}).click();
 await expect(page.locator(".product-fields dt").filter({hasText:"Batch number"})).toBeVisible();
 await expect(page.locator(".product-fields dd").filter({hasText:"BATCH-2026-001"})).toBeVisible();
 await expect(page.locator(".product-fields dd").filter({hasText:"500mL · বাংলাদেশ <b>plain text</b>"})).toBeVisible();
 await expect(page.locator(".product-fields b")).toHaveCount(0);
});
test("custom field names are unique and the form limits the number of fields",async({page})=>{
 await openAddProduct(page);await page.getByLabel("Product name",{exact:true}).fill("Duplicate field product");
 for(let i=1;i<=2;i++){await page.getByRole("button",{name:"Add field",exact:true}).click();await page.getByLabel("Detail name "+i,{exact:true}).fill(i===1?"Batch":" batch ");await page.getByLabel("Detail value "+i,{exact:true}).fill(String(i));}
 let writes=0;page.on("request",request=>{if(request.url().endsWith("/products/create")&&request.method()==="POST")writes++;});
 await page.getByRole("button",{name:"Add product",exact:true}).click();await expect(page.getByRole("status")).toContainText("unique name");expect(writes).toBe(0);
 for(let i=2;i<32;i++)await page.getByRole("button",{name:"Add field",exact:true}).click();
 await expect(page.getByRole("button",{name:"Add field",exact:true})).toBeDisabled();
 await page.getByRole("button",{name:"Remove field 1",exact:true}).click();
 await expect(page.getByLabel("Detail name 1",{exact:true})).toHaveValue(" batch ");
 await expect(page.getByRole("button",{name:"Add field",exact:true})).toBeEnabled();
});
test("business sign-in, products, filters and sign-out work through the real session gateway",async({page,context},testInfo)=>{
 const errors:string[]=[],calls:{path:string;auth:boolean;method:string}[]=[];
 page.on("pageerror",error=>errors.push(error.message));page.on("request",request=>{const path=new URL(request.url()).pathname;if(path.startsWith("/operator/api"))calls.push({path,auth:Boolean(request.headers().authorization),method:request.method()});});
 await signIn(page);
 await expect(page.getByText("Demo Supply Workspace",{exact:true})).toBeVisible();
 await expect(page.locator(".operator-product-row .text-bg-success")).toHaveText("In supply chain");
 await expect(page.locator(".operator-product-row .text-bg-info")).toHaveText("Out of supply chain");
 const cookies=await context.cookies();const session=cookies.find(cookie=>cookie.name==="tf_operator_dev")!;
 expect(session.httpOnly).toBe(true);expect(session.sameSite).toBe("Strict");expect(await page.evaluate(()=>document.cookie)).not.toContain("tf_operator_dev");
 expect(await page.evaluate(()=>[localStorage.length,sessionStorage.length])).toEqual([0,0]);
 expect(calls.every(call=>!call.auth)).toBe(true);
 await page.getByRole("combobox",{name:"Show",exact:true}).selectOption("mine");
 await expect(page.getByRole("link",{name:/Retail Tea Pack/})).toHaveCount(0);
 await page.getByRole("combobox",{name:"Show",exact:true}).selectOption("all");
 await page.getByLabel("Find a product",{exact:true}).fill("Retail");await expect(page.getByRole("link",{name:/Garden Tea Batch/})).toHaveCount(0);
 await page.getByLabel("Find a product",{exact:true}).fill("");
 expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze()).violations).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
 await page.screenshot({path:testInfo.outputPath("business-dashboard.png"),fullPage:true});
 await showBusinessMenu(page);await page.getByRole("button",{name:"Sign out",exact:true}).click();await expect(page).toHaveURL(/\/operator\/sign-in$/);
 await expect(page.locator("[data-operator-record]")).toHaveCount(0);expect((await context.cookies()).some(cookie=>cookie.name==="tf_operator_dev")).toBe(false);
});
test("businesses, operation status and named product supply history are readable",async({page})=>{
 await signIn(page);await navigateBusiness(page,"Businesses");
 await expect(page.getByRole("heading",{name:"Demo Distributor",exact:true})).toBeVisible();
 await navigateBusiness(page,"Activity");
 await expect(page.getByText("Confirmed",{exact:true})).toBeVisible();await expect(page.getByRole("heading",{name:"Update recorded",exact:true})).toBeVisible();
 await page.getByRole("link",{name:"View product",exact:true}).click();
 await expect(page.getByRole("heading",{name:operatorProduct.name,exact:true})).toBeVisible();
 await expect(page.locator(".operator-timeline li")).toHaveCount(2);await expect(page.locator(".operator-timeline time")).toHaveCount(2);
 await expect(page.getByText("Demo Producer → Demo Distributor",{exact:true})).toBeVisible();
 await expect(page).toHaveTitle("TraceForge · Product details");
 expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze()).violations).toEqual([]);
});
test("signed-out access and missing/revoked sessions never display product information",async({page,request})=>{
 expect((await request.get("/operator/api/products")).status()).toBe(401);
 await page.goto("/operator");await expect(page).toHaveURL(/\/operator\/sign-in$/);await expect(page.locator("[data-operator-record]")).toHaveCount(0);
 await page.goto("/operator/products/new");await expect(page).toHaveURL(/\/operator\/sign-in$/);await expect(page.getByLabel("Product name",{exact:true})).toHaveCount(0);
 await signIn(page);
 await page.route("**/operator/api/**",route=>route.fulfill({status:401,json:{error:{code:"signed_out"}}}));
 await page.getByRole("button",{name:"Refresh",exact:true}).click();await expect(page).toHaveURL(/\/operator\/sign-in$/);
 await expect(page.locator("[data-operator-record]")).toHaveCount(0);
});
test("gateway rejects CSRF, arbitrary targets, wrong methods and invalid identifiers",async({request})=>{
 expect((await request.post("/operator/api/login",{headers:{Origin:"https://evil.example"},data:{email:operatorUser.email,password:"Synthetic-Only-Password-2026"}})).status()).toBe(403);
 expect((await request.post("/operator/api/login",{data:{email:operatorUser.email,password:"Synthetic-Only-Password-2026"}})).status()).toBe(403);
 expect((await request.get("/operator/api/products?tenantId=external")).status()).toBe(400);
 expect((await request.get("/operator/api/products?url=https://evil.example")).status()).toBe(400);
 expect((await request.get("/operator/api/products/bad/history")).status()).toBe(400);
 expect((await request.post("/operator/api/products")).status()).toBe(405);
 expect((await request.get("/operator/api/login")).status()).toBe(405);
});
test("business type picker selects predefined values and requires a selection after clearing",async({page})=>{
 await page.goto("/operator/sign-in");
 await expect(page.getByRole("button",{name:"I have an invitation",exact:true})).toHaveCount(0);
 await page.getByRole("button",{name:"Register a business",exact:true}).click();
 await page.getByLabel("Your name",{exact:true}).fill("Demo Operator");
 await page.getByLabel("Business name",{exact:true}).fill("Independent Business");
 await page.getByLabel("Email address",{exact:true}).fill(operatorUser.email);
 await page.getByLabel("Password",{exact:true}).fill("Synthetic-Only-Password-2026");
 const picker=page.getByRole("combobox",{name:"Business type",exact:true});
 await picker.fill("Distrib");
 await expect(page.getByRole("option",{name:"Distributor",exact:true})).toBeVisible();
 expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze()).violations).toEqual([]);
 await page.getByRole("option",{name:"Distributor",exact:true}).click();
 await picker.focus();await picker.press("Backspace");
 let writes=0;page.on("request",request=>{if(request.url().endsWith("/signup")&&request.method()==="POST")writes++;});
 await page.getByRole("button",{name:"Register business",exact:true}).click();expect(writes).toBe(0);
 await picker.fill("Distributor");await picker.press("Enter");
 const sent=page.waitForRequest(request=>request.url().endsWith("/signup")&&request.method()==="POST");
 await page.getByRole("button",{name:"Register business",exact:true}).click();
 expect((await sent).postDataJSON()).toMatchObject({businessType:"Distributor"});
 await expect(page.getByText("Your business account is ready. Sign in with your email and password.")).toBeVisible();
 await expect(page.getByLabel("Password",{exact:true})).toHaveValue("");
 await expect(page.getByRole("button",{name:"I have an invitation",exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>[localStorage.length,sessionStorage.length])).toEqual([0,0]);
});
test("history pagination preserves exact large cursors",async({page})=>{
 const cursors:string[]=[];
 await page.route("**/operator/api/**",async route=>{
  const url=new URL(route.request().url()),path=url.pathname;
  if(path.endsWith("/me"))return route.fulfill({json:{user:operatorUser}});
  if(path.endsWith("/businesses"))return route.fulfill({json:operatorBusinesses});
  if(path.endsWith("/operations"))return route.fulfill({json:operatorOperations});
  if(path.endsWith("/history")){const after=url.searchParams.get("after")??"0";cursors.push(after);return route.fulfill({json:{...operatorHistory,events:after==="0"?[operatorHistory.events[0]]:[operatorHistory.events[1]],page:{hasMore:after==="0",next:after==="0"?operatorHistory.events[0].id:null}}});}
  return route.fulfill({json:operatorProducts});
 });
 await page.goto("/operator/products/"+operatorProduct.id);await expect(page.locator(".operator-timeline li")).toHaveCount(1);
 await page.getByRole("button",{name:"Show more updates",exact:true}).click();await expect(page.locator(".operator-timeline li")).toHaveCount(2);
 expect(cursors).toEqual(["0","9007199254741001"]);
});

test("product metadata and supply-chain labels use a responsive business sidebar",async({page},testInfo)=>{
 const product={...operatorProduct,closed:true,status:"Sold"};
 const events=[...operatorHistory.events,{...operatorHistory.events[0],id:"9007199254741003",name:"EntityClosed",label:"Sold · tracking closed"}];
 await page.route("**/operator/api/**",route=>{
  const path=new URL(route.request().url()).pathname;
  return route.fulfill({json:path.endsWith("/me")?{user:{...operatorUser,workspaceName:operatorUser.organizationName}}:path.endsWith("/businesses")?operatorBusinesses:path.endsWith("/operations")?operatorOperations:path.endsWith("/history")?{...operatorHistory,product,events}:operatorProducts});
 });
 await page.goto("/operator/products/"+product.id);
 await expect(page.getByRole("heading",{name:product.name,exact:true})).toBeVisible();
 const sidebar=page.getByRole("complementary",{name:"Business sidebar",exact:true});
 await expect(sidebar.getByText(operatorUser.organizationName,{exact:true})).toHaveCount(1);
 const metadata=page.locator(".product-fields");
 await expect(metadata.locator("dt").filter({hasText:/^Product name$/})).toBeVisible();
 await expect(metadata.locator("dd").filter({hasText:product.name})).toBeVisible();
 await expect(metadata.locator("dt").filter({hasText:/^Description$/})).toBeVisible();
 await expect(metadata.locator("dd").filter({hasText:product.description})).toBeVisible();
 await expect(page.locator(".operator-product-summary .text-bg-info")).toHaveText("Out of supply chain");
 await expect(page.locator(".operator-timeline h3 .text-bg-info")).toHaveText("Out of supply chain");
 await expect(page.locator(".operator-content")).not.toContainText(/\b(Open|Closed|Sold)\b/i);
 if(testInfo.project.name==="mobile"){
  await expect(sidebar.getByRole("navigation")).toBeHidden();
  await sidebar.getByRole("button",{name:"Show menu",exact:true}).click();
  await expect(sidebar.getByRole("navigation")).toBeVisible();
  await expect(sidebar.getByRole("button",{name:"Hide menu",exact:true})).toHaveAttribute("aria-expanded","true");
  await sidebar.getByRole("button",{name:"Hide menu",exact:true}).click();
  await expect(sidebar.getByRole("navigation")).toBeHidden();
 }else{
  expect(await sidebar.evaluate(element=>getComputedStyle(element).position)).toBe("fixed");
  expect((await sidebar.boundingBox())!.x).toBe(0);
 }
 await expect(page).toHaveTitle("TraceForge · Product details");
 expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze()).violations).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath("product-sidebar-and-metadata.png"),fullPage:true});
});

test("returning to a hidden dashboard revalidates access and respects a rate limit",async({page})=>{
 let limited=false,reads=0;
 await page.route("**/operator/api/**",async route=>{
  const path=new URL(route.request().url()).pathname;reads++;
  if(limited)return route.fulfill({status:429,headers:{"Retry-After":"60"},json:{}});
  return route.fulfill({json:path.endsWith("/me")?{user:operatorUser}:path.endsWith("/businesses")?operatorBusinesses:path.endsWith("/operations")?operatorOperations:operatorProducts});
 });
 await page.goto("/operator");await expect(page.locator("[data-operator-record]")).toBeVisible();
 await page.evaluate(()=>{Object.defineProperty(document,"visibilityState",{configurable:true,value:"hidden"});document.dispatchEvent(new Event("visibilitychange"));});
 await expect(page.locator("[data-operator-record]")).toBeHidden();limited=true;
 await page.evaluate(()=>{Object.defineProperty(document,"visibilityState",{configurable:true,value:"visible"});document.dispatchEvent(new Event("visibilitychange"));});
 await expect(page.getByRole("heading",{name:"Please wait a moment",exact:true})).toBeVisible();await expect(page.locator("[data-operator-record]")).toHaveCount(0);
 const count=reads;
 await page.evaluate(()=>{Object.defineProperty(document,"visibilityState",{configurable:true,value:"hidden"});document.dispatchEvent(new Event("visibilitychange"));Object.defineProperty(document,"visibilityState",{configurable:true,value:"visible"});document.dispatchEvent(new Event("visibilitychange"));});
 await expect(page.getByRole("button",{name:/Try again in/})).toBeDisabled();expect(reads).toBe(count);
});
