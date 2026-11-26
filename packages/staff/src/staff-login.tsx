'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CustomerSignInSchema, CustomerSignUpSchema, type Role } from '@kantin/shared';
import { Brand, Button, Field } from '@kantin/ui';
import { staffAuth } from './supabase';
import { useManagement } from './management';
export function StaffLogin({role}:{role:Role}){
  const router=useRouter();const {actor,error:identityError,refreshIdentity,signOut}=useManagement();
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const isTenant=role==='tenant';
  const portal=isTenant?'tenant':'admin';
  if(actor&&actor.role!==role)return <main className="login-page"><section className="panel login-card stack">
    <Brand/><h1>Masuk {portal}</h1>
    <p role="alert">Akun ini tidak memiliki akses ke portal {portal}.</p>
    {!isTenant&&process.env.NEXT_PUBLIC_TENANT_URL&&<Button asChild><a href={process.env.NEXT_PUBLIC_TENANT_URL}>Buka portal tenant</a></Button>}
    <Button variant="outline" onClick={()=>void signOut().catch(()=>setError('Belum dapat keluar.'))}>Keluar</Button>
    {error&&<p role="alert">{error}</p>}
  </section></main>;
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setError('');setMessage('');const auth=staffAuth();
    if(!auth){setError('Supabase Auth belum dikonfigurasi.');return;}
    if(!actor&&!CustomerSignInSchema.safeParse({email,password}).success){setError('Periksa email dan password.');return;}
    if(actor&&!CustomerSignUpSchema.shape.password.safeParse(password).success){setError('Password minimal 8 karakter.');return;}
    setBusy(true);
    try{const result=actor?await auth.auth.updateUser({password}):await auth.auth.signInWithPassword({email,password});if(result.error)throw new Error(actor?'Password belum dapat disimpan.':'Belum dapat masuk. Periksa email, password, dan aktivasi akun.');setPassword('');await refreshIdentity();if(actor)setMessage('Password berhasil disimpan.');else router.replace('/');}
    catch(failure:unknown){setError(failure instanceof Error?failure.message:'Layanan belum dapat dihubungi.');}finally{setBusy(false);}}
  return <main className="login-page"><section className="panel login-card stack">
    <Brand/><h1>{actor?'Akun '+portal:'Masuk '+portal}</h1>
    {!actor&&isTenant&&<p className="small muted">Gunakan email dan password yang diberikan admin kantin.</p>}
    <form className="stack" onSubmit={submit}>
      {!actor&&<Field label="Email"><input className="input" type="email" required maxLength={320} autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></Field>}
      <Field label={actor?'Password baru':'Password'}><input className="input" type="password" required minLength={actor?8:1} maxLength={128} autoComplete={actor?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)}/></Field>
      {error&&<p className="form-error" role="alert">{error}</p>}
      {!actor&&identityError&&!identityError.startsWith('Silakan masuk')&&<p className="form-error" role="alert">{identityError}</p>}
      {message&&<p role="status">{message}</p>}
      <Button type="submit" className="full" loading={busy}>{actor?'Simpan password':'Masuk'}</Button>
    </form>
    {!actor&&<Link className="link-action" href="/lupa-password">Lupa password?</Link>}
    {actor&&<><Button variant="outline" onClick={()=>router.replace('/')}>Lanjut ke panel</Button><Button variant="ghost" onClick={()=>void signOut().catch(()=>setError('Belum dapat keluar.'))}>Keluar</Button></>}
  </section></main>;
}
