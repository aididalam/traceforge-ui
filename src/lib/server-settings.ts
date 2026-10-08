import {readFileSync} from 'node:fs';
import {timingSafeEqual} from 'node:crypto';
import {isIP} from 'node:net';
import {publicOrigin} from './urls';
export function serverSecret(name:string) {
  const file=process.env[name+'_FILE'];
  if(file&&process.env[name])throw Error(`Configure only ${name} or ${name}_FILE`);
  return file?readFileSync(file,'utf8').trim():process.env[name];
}
export function upstreamOrigin(value:string) {
  if(value===process.env.TRACEFORGE_INTERNAL_API_ORIGIN){
    const url=new URL(value);
    if(url.protocol==='http:'&&url.hostname==='api'&&!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname==='/')return url.origin;
  }
  return publicOrigin(value,true);
}
export function gatewayHeaders(request:Request):Record<string,string> {
  const key=serverSecret('TRACEFORGE_PROXY_KEY');
  const supplied=request.headers.get('x-traceforge-proxy-key');
  const ip=request.headers.get('x-traceforge-client-ip');
  if(!key||!supplied||!ip||!isIP(ip))return {};
  const actual=Buffer.from(supplied),expected=Buffer.from(key);
  return actual.length===expected.length&&timingSafeEqual(actual,expected)?{'x-traceforge-proxy-key':key,'x-traceforge-client-ip':ip}:{};
}
