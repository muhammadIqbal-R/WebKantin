'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CustomerSignInSchema, CustomerSignUpSchema } from '@kantin/shared';
import { Brand, Button, Field } from '@kantin/ui';
import { staffAuth } from '../../lib/supabase';
import { useManagement } from '../../components/management';
export default function LoginPage(){
  const router=useRouter();const {actor,error:identityError,refreshIdentity,signOut}=useManagement();
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setError('');setMessage('');const auth=staffAuth();
    if(!auth){setError('Supabase Auth belum dikonfigurasi.');return;}
    if(!actor&&!CustomerSignInSchema.safeParse({email,password}).success){setError('Periksa email dan password.');return;}
    if(actor&&!CustomerSignUpSchema.shape.password.safeParse(password).success){setError('Password minimal 8 karakter.');return;}
    setBusy(true);
    try{const result=actor?await auth.auth.updateUser({password}):await auth.auth.signInWithPassword({email,password});if(result.error)throw new Error(actor?'Password belum dapat disimpan.':'Belum dapat masuk. Periksa email, password, dan aktivasi akun.');setPassword('');await refreshIdentity();if(actor)setMessage('Password berhasil disimpan.');else router.replace('/');}
    catch(failure:unknown){setError(failure instanceof Error?failure.message:'Layanan belum dapat dihubungi.');}finally{setBusy(false);}}
  return <main className="login-page"><section className="panel login-card stack"><Brand/><h1>{actor?'Akun pengelola':'Masuk'}</h1><p className="small muted">{actor?'Anda dapat menetapkan password setelah menerima undangan.':'Admin memakai akun yang ditetapkan pemilik sistem. Tenant masuk setelah menerima undangan email dari admin. Pendaftaran pelanggan tidak memberi akses pengelola.'}</p><form className="stack" onSubmit={submit}>{!actor?<Field label="Email"><input className="input" type="email" required maxLength={320} autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></Field>:null}<Field label={actor?'Password baru':'Password'}><input className="input" type="password" required minLength={actor?8:1} maxLength={128} autoComplete={actor?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)}/></Field>{error?<p className="form-error" role="alert">{error}</p>:null}{!actor&&identityError&&!identityError.startsWith('Silakan masuk')?<p className="form-error" role="alert">{identityError}</p>:null}{message?<p role="status">{message}</p>:null}<Button type="submit" className="full" loading={busy}>{actor?'Simpan password':'Masuk'}</Button></form>{!actor?<Link className="link-action" href="/lupa-password">Lupa password?</Link>:null}{actor?<><Button variant="outline" onClick={()=>router.replace('/')}>Lanjut ke panel</Button><Button variant="ghost" onClick={()=>void signOut().catch(()=>setError('Belum dapat keluar.'))}>Keluar</Button></>:null}</section></main>;
}
