import {defineConfig,devices} from "@playwright/test";
export default defineConfig({
 testDir:"tests",testMatch:"**/*.integration.ts",fullyParallel:false,workers:1,
 timeout:600000,retries:0,reporter:"list",outputDir:"integration-results",
 use:{baseURL:"http://127.0.0.1:13478",serviceWorkers:"block",trace:"off",screenshot:"only-on-failure"},
 projects:[
  {name:"desktop",use:{...devices["Desktop Chrome"],viewport:{width:1440,height:1100}}},
  {name:"mobile",use:{...devices["Pixel 7"],defaultBrowserType:"chromium"}},
 ],
});
