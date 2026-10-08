import {createCipheriv, createDecipheriv, randomBytes} from 'node:crypto';
import mysql, {type Pool, type RowDataPacket} from 'mysql2/promise';
import {serverSecret} from './server-settings';
import {configuredSiteOrigin} from './site-config';

export type Session={token:string;expires:number};
const state=globalThis as typeof globalThis & {traceforgeOperatorSessions?:Map<string,Session>;traceforgeSessionPool?:Pool};
const memory=state.traceforgeOperatorSessions??=new Map<string,Session>();
function durable(){
 const mode=process.env.TRACEFORGE_SESSION_STORE??'memory';
 if(!['memory','mysql'].includes(mode))throw Error('Invalid session store');
 if(mode==='memory'&&process.env.NODE_ENV==='production'){
  const origin=configuredSiteOrigin();
  if(origin&&!['127.0.0.1','localhost','[::1]'].includes(new URL(origin).hostname))throw Error('Hosted login requires the shared MySQL session store');
 }
 return mode==='mysql';
}
function pool(){
 return state.traceforgeSessionPool??=mysql.createPool({host:process.env.MYSQL_HOST,port:Number(process.env.MYSQL_PORT||3306),database:process.env.MYSQL_DATABASE,user:process.env.MYSQL_USER,password:serverSecret('MYSQL_PASSWORD'),connectionLimit:5,supportBigNumbers:true,bigNumberStrings:true});
}
function key(){const value=serverSecret('TRACEFORGE_SESSION_KEY');if(!value||!/^[a-fA-F0-9]{64}$/.test(value))throw Error('Session encryption key is required');return Buffer.from(value,'hex');}
export function encryptToken(token:string,handle:string){
 const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),nonce);cipher.setAAD(Buffer.from(handle));
 const encrypted=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);
 return [nonce.toString('hex'),encrypted.toString('hex'),cipher.getAuthTag().toString('hex')].join('.');
}
export function decryptToken(value:string,handle:string){
 const [nonce,text,tag]=value.split('.');
 if(!/^[a-f0-9]{24}$/.test(nonce||'')||!/^[a-f0-9]+$/.test(text||'')||!/^[a-f0-9]{32}$/.test(tag||''))throw Error('Invalid encrypted session');
 const cipher=createDecipheriv('aes-256-gcm',key(),Buffer.from(nonce,'hex'));cipher.setAAD(Buffer.from(handle));cipher.setAuthTag(Buffer.from(tag,'hex'));
 return Buffer.concat([cipher.update(Buffer.from(text,'hex')),cipher.final()]).toString('utf8');
}
export async function findSession(handle:string):Promise<Session|null>{
 if(!durable())return memory.get(handle)??null;
 const [rows]=await pool().execute<RowDataPacket[]>('SELECT encrypted_token,expires_ms FROM ui_operator_sessions WHERE handle_hash=? AND expires_ms>?',[handle,Date.now()]);
 if(!rows.length)return null;
 return {token:decryptToken(rows[0].encrypted_token,handle),expires:Number(rows[0].expires_ms)};
}
export async function deleteSession(handle:string){if(!durable()){memory.delete(handle);return;}await pool().execute('DELETE FROM ui_operator_sessions WHERE handle_hash=?',[handle]);}
export async function saveSession(handle:string,session:Session){
 if(!durable()){
  for(const [id,value]of memory)if(value.expires<=Date.now())memory.delete(id);
  if(memory.size>=1000)throw Error('Session capacity exceeded');memory.set(handle,session);return;
 }
 await pool().execute('DELETE FROM ui_operator_sessions WHERE expires_ms<=?',[Date.now()]);
 await pool().execute('INSERT INTO ui_operator_sessions(handle_hash,encrypted_token,expires_ms) VALUES(?,?,?)',[handle,encryptToken(session.token,handle),session.expires]);
}
