import { test,expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { operatorUser,operatorProduct,operatorProducts,operatorBusinesses,operatorHistory,operatorOperations } from "./operator-fixtures";
async function signIn(page:import("@playwright/test").Page){
 await page.goto("/operator/sign-in");await page.getByLabel("Email address",{exact:true}).fill(operatorUser.email);
 await page.getByLabel("Password",{exact:true}).fill("Synthetic-Only-Password-2026");await page.getByRole("button",{name:"Sign in",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Business dashboard",exact:true})).toBeVisible();
 await expect(page.getByRole("link",{name:"Garden Tea Batch 001"})).toBeVisible();
}
test("business sign-in, products, filters and sign-out work through the real session gateway",async({page,context},testInfo)=>{
 const errors:string[]=[],calls:{path:string;auth:boolean;method:string}[]=[];
 page.on("pageerror",error=>errors.push(error.message));page.on("request",request=>{const path=new URL(request.url()).pathname;if(path.startsWith("/operator/api"))calls.push({path,auth:Boolean(request.headers().authorization),method:request.method()});});
 await signIn(page);
 await expect(page.getByText("Demo Supply Workspace",{exact:true})).toBeVisible();
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
 await page.getByRole("button",{name:"Sign out",exact:true}).click();await expect(page).toHaveURL(/\/operator\/sign-in$/);
 await expect(page.locator("[data-operator-record]")).toHaveCount(0);expect((await context.cookies()).some(cookie=>cookie.name==="tf_operator_dev")).toBe(false);
});
test("businesses, operation status and named product supply history are readable",async({page})=>{
 await signIn(page);await page.getByRole("navigation",{name:"Business dashboard"}).getByRole("link",{name:"Businesses",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Demo Distributor",exact:true})).toBeVisible();
 await page.getByRole("navigation",{name:"Business dashboard"}).getByRole("link",{name:"Operation activity",exact:true}).click();
 await expect(page.getByText("Confirmed",{exact:true})).toBeVisible();await expect(page.getByRole("heading",{name:"Update recorded",exact:true})).toBeVisible();
 await page.getByRole("link",{name:"View product",exact:true}).click();
 await expect(page.getByRole("heading",{name:operatorProduct.name,exact:true})).toBeVisible();
 await expect(page.locator(".operator-timeline li")).toHaveCount(2);await expect(page.locator(".operator-timeline time")).toHaveCount(2);
 await expect(page.getByText("Demo Producer → Demo Distributor",{exact:true})).toBeVisible();
 expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze()).violations).toEqual([]);
});
test("signed-out access and missing/revoked sessions never display product information",async({page,request})=>{
 expect((await request.get("/operator/api/products")).status()).toBe(401);
 await page.goto("/operator");await expect(page).toHaveURL(/\/operator\/sign-in$/);await expect(page.locator("[data-operator-record]")).toHaveCount(0);
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
test("invitation activation leads to sign-in without persisting password or invitation",async({page})=>{
 await page.goto("/operator/sign-in");await page.getByRole("button",{name:"I have an invitation",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Join your business",exact:true})).toBeVisible();
 await page.getByLabel("Your name",{exact:true}).fill("Demo Operator");await page.getByLabel("Email address",{exact:true}).fill(operatorUser.email);
 await page.getByLabel("Invitation code",{exact:true}).fill("tfoi_"+"A".repeat(43));await page.getByLabel("Password",{exact:true}).fill("Synthetic-Only-Password-2026");
 await page.getByRole("button",{name:"Create account",exact:true}).click();await expect(page.getByText("Your account is ready. Sign in with your email and password.",{exact:true})).toBeVisible();
 await expect(page.getByLabel("Password",{exact:true})).toHaveValue("");await expect(page.getByLabel("Invitation code",{exact:true})).toHaveCount(0);
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
