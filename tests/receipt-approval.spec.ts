import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {operatorUser,operatorProduct,otherBusinessId} from './operator-fixtures';
const ids=['12345678-1234-4234-8234-123456789abc','12345678-1234-4234-8234-123456789def'];
const wallet='0x'+'ab'.repeat(20);
const request=(index:number)=>({id:ids[index],trackingId:operatorProduct.id,name:'Tea batch',
 source:{id:operatorUser.organizationId,name:'Our business',walletAddress:'0x'+'cd'.repeat(20)},
 requester:{id:otherBusinessId,name:'Receiving business',walletAddress:wallet},sourceRouteId:'0x'+'bb'.repeat(32),
 quantity:index?'4':'7',status:'WAITING_APPROVAL',createdAt:'2026-10-10T08:00:00.000Z',expiresAt:'2026-10-13T08:00:00.000Z',transactionHash:null,errorCode:null});
async function signIn(page:import('@playwright/test').Page){
 await page.goto('/operator/sign-in');await page.getByLabel('Email address',{exact:true}).fill(operatorUser.email);await page.getByLabel('Password',{exact:true}).fill('Synthetic-Only-Password-2026');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.locator('[data-operator-record]')).toBeVisible();
}
test('owner sees requester hex identities and approves multiple requests with per-item stock guards',async({page})=>{
 let rows=[request(0),request(1)];
 await page.route('**/operator/api/receipt-requests?*',route=>route.fulfill({json:{requests:rows,page:{hasMore:false,next:null}}}));
 await signIn(page);await page.goto('/operator/requests');
 await expect(page.locator('article')).toHaveCount(2);await expect(page.locator('article').first()).toContainText(wallet);await expect(page.locator('article').first()).toContainText(otherBusinessId);
 await page.getByLabel('Select pending requests',{exact:true}).check();
 await page.route('**/operator/api/receipt-requests/decisions',route=>{
  expect(route.request().postDataJSON()).toMatchObject({requestIds:ids,action:'approve'});expect(route.request().headers().authorization).toBeUndefined();
  rows=[{...rows[0],status:'APPROVING'},rows[1]];
  return route.fulfill({status:202,json:{results:[{requestId:ids[0],ok:true,result:{operationId:ids[0],receiptRequestId:ids[0],trackingId:operatorProduct.id,status:'APPROVING',quantity:'7',transactionHash:null,blockNumber:null},error:null},{requestId:ids[1],ok:false,result:null,error:{code:'quantity_exceeds_available'}}]}});
 });
 await page.getByRole('button',{name:'Approve selected (2)',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'1 request queued'})).toBeVisible();await expect(page.getByRole('alert').filter({hasText:'Not enough available stock'})).toBeVisible();
 await expect(page.locator('article').first().getByRole('checkbox')).toBeDisabled();
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
});
test('requester can cancel a pending request and sees no owner approve action',async({page})=>{
 const row=request(0);let status='WAITING_APPROVAL';
 await page.route('**/operator/api/receipt-requests?*',route=>route.fulfill({json:{requests:[{...row,status}],page:{hasMore:false,next:null}}}));
 await signIn(page);await page.goto('/operator/requests');await page.getByRole('button',{name:'My requests',exact:true}).click();
 await expect(page.getByRole('button',{name:/Approve selected/})).toHaveCount(0);await page.getByLabel('Select pending requests',{exact:true}).check();
 await page.route('**/operator/api/receipt-requests/decisions',route=>{expect(route.request().postDataJSON().action).toBe('cancel');status='CANCELLED';return route.fulfill({status:202,json:{results:[{requestId:row.id,ok:true,result:{operationId:row.id,receiptRequestId:row.id,trackingId:row.trackingId,status,quantity:row.quantity,transactionHash:null,blockNumber:null},error:null}]}});});
 await page.getByRole('button',{name:'Cancel selected',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'1 request cancelled'})).toBeVisible();await expect(page.locator('article')).toContainText('Cancelled');
});
test('a bulk request list preserves both product identities and keys through an uncertain response',async({page})=>{
 const products=[operatorProduct.id,'0x'+'88'.repeat(32)];
 await page.route('**/operator/api/receive/*',route=>{
  const trackingId=new URL(route.request().url()).pathname.split('/').at(-1)!;
  return route.fulfill({json:{trackingId,name:'Tea '+products.indexOf(trackingId),holder:{id:otherBusinessId,name:'Source business'},closed:false,version:'0',canReceive:true}});
 });
 await signIn(page);await page.goto('/operator/receive');
 for(const product of products){
  await page.getByLabel('Tracking ID or product / batch ID',{exact:true}).fill(product);
  await page.getByRole('button',{name:'Find product',exact:true}).click();
  await page.getByLabel('I have physically received this product',{exact:true}).check();
  await page.getByRole('button',{name:'Add to request list',exact:true}).click();
 }
 await expect(page.getByRole('heading',{name:'Request list (2 / 100)',exact:true})).toBeVisible();
 const payloads:Record<string,unknown>[]=[];
 await page.route('**/operator/api/receipt-requests',route=>{
  const body=route.request().postDataJSON();payloads.push(body);
  expect(body.requests.map((r:{trackingId:string})=>r.trackingId)).toEqual(products);
  expect(new Set(body.requests.map((r:{idempotencyKey:string})=>r.idempotencyKey)).size).toBe(2);
  if(payloads.length===1)return route.fulfill({status:503,json:{error:{code:'unavailable'}}});
  return route.fulfill({status:202,json:{results:body.requests.map((r:{trackingId:string},i:number)=>({trackingId:r.trackingId,ok:true,result:{operationId:ids[i],receiptRequestId:ids[i],status:'WAITING_APPROVAL',trackingId:r.trackingId,quantity:'1',transactionHash:null,blockNumber:null},error:null}))}});
 });
 await page.getByRole('button',{name:'Send 2 requests',exact:true}).click();
 await expect(page.getByRole('button',{name:'Retry request list',exact:true})).toBeEnabled();
 await expect(page.getByLabel('Tracking ID or product / batch ID',{exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remove',exact:true}).first()).toBeDisabled();
 await page.getByRole('button',{name:'Retry request list',exact:true}).click();
 expect(payloads[1]).toEqual(payloads[0]);
 await expect(page.getByRole('status').filter({hasText:'2 requests sent for owner approval'})).toBeVisible();
 await expect(page.getByRole('heading',{name:/Request list/})).toHaveCount(0);
});
