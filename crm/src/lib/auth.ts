import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { getDb } from './db';

export type Role = 'ADMIN' | 'HR' | 'FINANCE' | 'CRM';
export type CurrentUser = { id: string; email: string; displayName: string; role: Role; mustChangePassword: boolean };
const COOKIE = 'metrics_session';

const randomToken=(bytes:number)=>{const a=new Uint8Array(bytes);crypto.getRandomValues(a);return Buffer.from(a).toString('base64url')};
export async function hashPassword(password: string, salt = randomToken(16)) {
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},material,256);
  return `${salt}:${Buffer.from(bits).toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const actual = (await hashPassword(password, salt)).split(':')[1];
  const a = Buffer.from(actual, 'hex'); const b = Buffer.from(expected, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

export async function currentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const row = await db.prepare(`SELECT u.id,u.email,u.display_name,u.role,u.must_change_password
    FROM crm_sessions s JOIN crm_users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.expires_at>datetime('now') AND u.active=1`).bind(tokenHash(token)).first<Record<string, unknown>>();
  if (!row) return null;
  return { id:String(row.id), email:String(row.email), displayName:String(row.display_name), role:String(row.role) as Role, mustChangePassword:Boolean(row.must_change_password) };
}
export async function requireUser(roles?: Role[]) {
  const user = await currentUser();
  if (!user) redirect('/login');
  if (roles && !roles.includes(user.role)) throw new Error('AUTHORIZATION_ERROR');
  return user;
}
export async function createSession(userId: string) {
  const token = randomToken(32);
  const db = await getDb();
  await db.prepare("INSERT INTO crm_sessions(id,user_id,token_hash,expires_at) VALUES(?,?,?,datetime('now','+12 hours'))")
    .bind(randomUUID(), userId, tokenHash(token)).run();
  (await cookies()).set(COOKIE, token, { httpOnly:true, secure:process.env.NODE_ENV==='production', sameSite:'lax', path:'/', maxAge:43200 });
}
export async function destroySession() {
  const jar = await cookies(); const token = jar.get(COOKIE)?.value;
  if (token) await (await getDb()).prepare('DELETE FROM crm_sessions WHERE token_hash=?').bind(tokenHash(token)).run();
  jar.delete(COOKIE);
}
export async function audit(action:string, entityType:string, entityId:string|null, metadata:Record<string,unknown>={}) {
  const user = await currentUser();
  await (await getDb()).prepare('INSERT INTO audit_events(id,actor_user_id,action,entity_type,entity_id,metadata_json) VALUES(?,?,?,?,?,?)')
    .bind(randomUUID(), user?.id || null, action, entityType, entityId, JSON.stringify(metadata)).run();
}
