import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { HttpError } from './errors.js';
export class Accounts {
  private client: SupabaseClient | null;
  constructor(url: string, key: string | undefined, private redirect: string) {
    this.client = key ? createClient(url, key, {auth:{persistSession:false, autoRefreshToken:false}}) : null;
  }
  private admin() {
    if (!this.client) throw new HttpError(503, 'Layanan pengelolaan akun belum dikonfigurasi.');
    return this.client.auth.admin;
  }
  async list(page: number) {
    const {data,error} = await this.admin().listUsers({page,perPage:50});
    if(error) throw new HttpError(503, 'Daftar pengguna belum dapat dimuat.');
    return data.users;
  }
  async invite(email: string) {
    const {data,error} = await this.admin().inviteUserByEmail(email, {redirectTo:this.redirect + '/login'});
    if(error || !data.user) throw new HttpError(409, 'Undangan gagal. Periksa email atau akun yang sudah terdaftar.');
    return data.user;
  }
  async setActive(id: string, active: boolean) {
    const {error} = await this.admin().updateUserById(id,{ban_duration:active?'none':'876000h'});
    if(error) throw new HttpError(503, 'Status masuk Auth belum diperbarui. Muat ulang lalu coba kembali.');
  }
  async get(id:string){const {data,error}=await this.admin().getUserById(id);if(error||!data.user)throw new HttpError(404,'Akun Auth tidak ditemukan.');return data.user;}
}
