'use client';
import { useActionState } from 'react';
import { login } from '../auth-actions';
export default function LoginPage(){
  const [state,action,pending]=useActionState(login,null);
  return <main className="min-h-screen bg-gray-950 flex items-center justify-center p-4"><form action={action} className="w-full max-w-sm bg-white rounded-2xl p-7 shadow-xl space-y-5">
    <div><h1 className="text-2xl font-bold">MetricsCRM</h1><p className="text-sm text-gray-500 mt-1">Sign in to your workspace</p></div>
    <label className="block text-sm font-medium">Email<input name="email" type="text" required autoComplete="username" className="mt-1 w-full border rounded-lg p-3"/></label>
    <label className="block text-sm font-medium">Password<input name="password" type="password" required autoComplete="current-password" className="mt-1 w-full border rounded-lg p-3"/></label>
    {state?.error&&<p role="alert" className="text-sm text-red-600">{state.error}</p>}
    <button disabled={pending} className="w-full bg-cyan-500 text-gray-950 font-semibold rounded-lg p-3 disabled:opacity-50">{pending?'Signing in…':'Sign in'}</button>
  </form></main>;
}
