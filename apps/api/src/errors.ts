export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function adminOnly(role: string) {
  if (role !== 'admin_pengelola') throw new HttpError(403, 'Akses khusus admin pengelola.');
}
export function tenantOnly(role: string) {
  if (role !== 'tenant') throw new HttpError(403, 'Aksi ini hanya tersedia untuk tenant pesanan.');
}
export function databaseCode(error:unknown,depth=0):string {
  if(!error||typeof error!=='object'||depth>5)return '';
  if('code'in error&&typeof error.code==='string'&&/^(?:P\d{4}|[0-9A-Z]{5})$/.test(error.code))return error.code;
  if('originalCode'in error&&typeof error.originalCode==='string')return error.originalCode;
  for(const key of ['cause','meta','driverAdapterError'] as const){if(key in error){const nested=databaseCode((error as Record<string,unknown>)[key],depth+1);if(nested)return nested;}}
  return '';
}
