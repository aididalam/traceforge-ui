import { operatorUser, businessId, otherBusinessId } from "./operator-fixtures.ts";
import { entity, hash, tenantId } from "./fixtures.ts";
export const batchId="0x"+"ab".repeat(32), batchCode="abc123xyz789", thirdBusinessId="0x"+"99".repeat(32);
export const batchQuantity={externalId:"A / BATCH-001",initialQuantity:"1000000",availableQuantity:"899300",removedQuantity:"100700",isBatch:true,inSupplyChain:true,
 reasons:[{reason:"Sold",quantity:"100000"},{reason:"Lost",quantity:"200"},{reason:"Damaged",quantity:"0"},{reason:"Spoiled",quantity:"500"},{reason:"Disposed",quantity:"0"},{reason:"Other",quantity:"0"}]};
const base={parentRouteId:"0x"+"00".repeat(32),receivedQuantity:"600000",availableQuantity:"300000",version:"9007199254741001",receivedAt:"1791283200"};
export const sourceRoutes=[{...base,id:"0x"+"a1".repeat(32),owner:{id:otherBusinessId,name:"Independent Distributor"},previousOwner:{id:businessId,name:"Demo Producer"}},
 {...base,id:"0x"+"a2".repeat(32),owner:{id:otherBusinessId,name:"Independent Distributor"},previousOwner:{id:thirdBusinessId,name:"Repair Workshop"},availableQuantity:"400000",receivedQuantity:"400000",receivedAt:"1791293200"}];
export const ownRoutes=[{...base,id:"0x"+"b1".repeat(32),owner:{id:businessId,name:"Demo Producer"},previousOwner:sourceRoutes[0].owner,availableQuantity:"99300",receivedQuantity:"100000"},
 {...base,id:"0x"+"b2".repeat(32),owner:{id:businessId,name:"Demo Producer"},previousOwner:sourceRoutes[1].previousOwner,availableQuantity:"100000",receivedQuantity:"100000",receivedAt:"1791303200"}];
export const firstRoutePage={routes:[sourceRoutes[0],ownRoutes[0]],page:{hasMore:true,next:"9007199254741010"}};
export const secondRoutePage={routes:[sourceRoutes[1],ownRoutes[1]],page:{hasMore:false,next:null}};
export const batchPreview={trackingId:batchId,name:"Cola batch",holder:null,closed:false,version:null,canReceive:true,quantity:{...batchQuantity,ownAvailableQuantity:"199300"},...firstRoutePage};
export const batchProduct={id:batchId,name:"Cola batch",description:null,type:"Product",status:null,closed:false,createdAt:"1791283200",holder:null,fields:[{label:"Ingredients",value:"Water, sugar"}],quantity:{...batchQuantity,ownAvailableQuantity:"199300"}};
export const batchHistory={product:batchProduct,events:[{id:"9007199254741001",name:"ProductRegistered",label:null,occurredAt:"1791283200",organizationId:businessId,fromId:null,toId:null,transactionHash:hash,quantity:{quantity:"1000000",reason:null,reasonText:null,routeId:ownRoutes[0].id,receivedRouteId:null}},
 {id:"9007199254741002",name:"QuantityRemoved",label:null,occurredAt:"1791293200",organizationId:businessId,fromId:null,toId:null,transactionHash:hash,quantity:{quantity:"500",reason:"Spoiled",reasonText:"Broken packaging <b>plain text</b>",routeId:ownRoutes[0].id,receivedRouteId:null}}],page:{hasMore:false,next:null}};
export const searchProduct={trackingId:batchId,shortCode:batchCode,name:"Cola batch",externalId:batchQuantity.externalId,origin:{id:businessId,name:"Demo Producer",businessCode:"A"},isBatch:true,initialQuantity:batchQuantity.initialQuantity,availableQuantity:batchQuantity.availableQuantity,inSupplyChain:true};
export const searchPage={products:[searchProduct,{...searchProduct,trackingId:"0x"+"ac".repeat(32),shortCode:"abc123xyz788",name:"Another Cola batch",origin:{id:thirdBusinessId,name:"Repair Workshop",businessCode:"B"}}],page:{hasMore:false,next:null}};
export const batchPublic={...entity,tenantId,entityId:batchId,entityTypeLabel:"Product",currentCustodian:"0x"+"00".repeat(32),closed:false,currentHolder:null,productInfo:{name:"Cola batch",description:null,fields:batchProduct.fields},quantity:batchQuantity};
export const batchPublicHistory={tenantId,entityId:batchId,entity:batchPublic,events:[],page:{limit:50,hasMore:false,nextAfterEventId:null}};
export const batchHolders={holders:[{id:businessId,name:"Demo Producer",availableQuantity:"199300",routeCount:2},{id:otherBusinessId,name:"Independent Distributor",availableQuantity:"700000",routeCount:2}],page:{hasMore:false,next:null}};
export const writeResult={operationId:operatorUser.accountId,status:"CONFIRMED",transactionHash:hash,blockNumber:"42",trackingId:batchId};
