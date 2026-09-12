'use server';
import { getDb } from '@/lib/db';
import { createSession, destroySession, hashPassword, verifyPassword, requireUser } from '@/lib/auth';
import { randomUUID } from 'crypto';
import { redirect } from 'next/navigation';

export async function login(_: {error?:string}|null, formData: FormData) {
  const email=String(formData.get('email')||'').trim().toLowerCase(); const password=String(formData.get('password')||'');
  const db=await getDb();
  let user=await db.prepare('SELECT * FROM crm_users WHERE email=? AND active=1').bind(email).first<Record<string,unknown>>();
  const count=await db.prepare('SELECT count(*) n FROM crm_users').first<{n:number}>();
  if (!count?.n && email===(process.env.BOOTSTRAP_ADMIN_EMAIL||process.env.ADMIN_USERNAME||'admin').toLowerCase() && password===(process.env.BOOTSTRAP_ADMIN_PASSWORD||process.env.ADMIN_PASSWORD||'metrics2026')) {
    const id=randomUUID(); const hash=await hashPassword(password);
    await db.prepare("INSERT INTO crm_users(id,email,display_name,password_hash,role,must_change_password) VALUES(?,?,?,?,'ADMIN',1)")
      .bind(id,email,process.env.BOOTSTRAP_ADMIN_NAME||'Administrator',hash).run();
    user=await db.prepare('SELECT * FROM crm_users WHERE id=?').bind(id).first<Record<string,unknown>>();
  }
  if (!user || !(await verifyPassword(password,String(user.password_hash)))) return {error:'Invalid email or password.'};
  await createSession(String(user.id)); redirect('/');
}
export async function logout(){ await destroySession(); redirect('/login'); }
export async function changePassword(_: {error?:string}|null,fd:FormData){const user=await requireUser();const password=String(fd.get('password')||''),confirm=String(fd.get('confirm')||'');if(password.length<12)return{error:'Use at least 12 characters.'};if(password!==confirm)return{error:'Passwords do not match.'};const hash=await hashPassword(password);await(await getDb()).prepare("UPDATE crm_users SET password_hash=?,must_change_password=0,updated_at=datetime('now') WHERE id=?").bind(hash,user.id).run();redirect('/');}
