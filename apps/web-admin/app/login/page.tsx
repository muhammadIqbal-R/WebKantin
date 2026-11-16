'use client';
import { useState, type FormEvent } from 'react';
import { Brand, Button, Field } from '@kantin/ui';
export default function LoginPage() {
  const [error,setError] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Staff authentication requires the API to verify the active staff profile.
    setError('Layanan masuk pengelola belum tersedia. Silakan coba lagi nanti.');
  }
  return <main className="login-page"><section className="panel login-card"><Brand /><h1>Masuk</h1>
    <form className="stack" onSubmit={submit}>
      <Field label="Email"><input className="input" type="email" required autoComplete="username" maxLength={320} /></Field>
      <Field label="Password"><input className="input" type="password" required autoComplete="current-password" maxLength={128} /></Field>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <Button type="submit" className="full">Masuk</Button>
    </form></section></main>;
}
