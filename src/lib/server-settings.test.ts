import {describe,it,expect,vi,afterEach} from 'vitest';
import {upstreamOrigin,gatewayHeaders} from './server-settings';
import {encryptToken,decryptToken} from './operator-sessions';
afterEach(()=>vi.unstubAllEnvs());
describe('container gateway and encrypted sessions',()=>{
 it('accepts only the explicitly configured internal API origin',()=>{
  expect(()=>upstreamOrigin('http://api:3000')).toThrow();
  vi.stubEnv('TRACEFORGE_INTERNAL_API_ORIGIN','http://api:3000');
  expect(upstreamOrigin('http://api:3000')).toBe('http://api:3000');
  for(const origin of ['http://evil:3000','http://api:3000/private','http://user:password@api:3000'])expect(()=>upstreamOrigin(origin)).toThrow();
 });
 it('forwards client identity only when the private proxy key matches',()=>{
  vi.stubEnv('TRACEFORGE_PROXY_KEY','synthetic-proxy-key');
  const request=(key:string,ip:string)=>new Request('https://site.example',{headers:{'x-traceforge-proxy-key':key,'x-traceforge-client-ip':ip}});
  expect(gatewayHeaders(request('wrong','192.0.2.1'))).toEqual({});
  expect(gatewayHeaders(request('synthetic-proxy-key','not-an-ip'))).toEqual({});
  expect(gatewayHeaders(request('synthetic-proxy-key','192.0.2.1'))['x-traceforge-client-ip']).toBe('192.0.2.1');
 });
 it('encrypts upstream credentials with authenticated encryption bound to the session handle',()=>{
  vi.stubEnv('TRACEFORGE_SESSION_KEY','ab'.repeat(32));
  const token='tfos_'+ 'A'.repeat(43),handle='1'.repeat(64),encrypted=encryptToken(token,handle);
  expect(encrypted).not.toContain(token);expect(decryptToken(encrypted,handle)).toBe(token);
  expect(()=>decryptToken(encrypted,'2'.repeat(64))).toThrow();
  const parts=encrypted.split('.');parts[2]='0'.repeat(32);expect(()=>decryptToken(parts.join('.'),handle)).toThrow();
 });
});
