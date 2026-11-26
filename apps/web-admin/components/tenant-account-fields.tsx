'use client';

import { Field } from '@kantin/ui';

export function TenantAccountFields({email,password,onEmail,onPassword,disabled}:{
  email:string;
  password:string;
  onEmail:(value:string)=>void;
  onPassword:(value:string)=>void;
  disabled:boolean;
}) {
  return <>
    <Field label="Email tenant">
      <input className="input" type="email" required maxLength={320} disabled={disabled}
        value={email} onChange={event=>onEmail(event.target.value)} />
    </Field>
    <Field label="Password awal" hint="8–72 karakter. Berikan password langsung kepada pemilik akun.">
      <input className="input" type="password" autoComplete="new-password" minLength={8} maxLength={72} required
        disabled={disabled} value={password} onChange={event=>onPassword(event.target.value)} />
    </Field>
  </>;
}
