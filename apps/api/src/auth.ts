import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { IdSchema } from '@kantin/shared';
import { HttpError } from './errors.js';
export function createVerifier(projectUrl: string, resolver?: JWTVerifyGetKey) {
  const issuer = projectUrl.replace(/\/$/, '') + '/auth/v1';
  const jwks = resolver ?? createRemoteJWKSet(new URL(issuer + '/.well-known/jwks.json'));
  return async (token: string): Promise<string> => {
    try {
      const { payload } = await jwtVerify(token, jwks, { issuer, audience: 'authenticated', algorithms: ['ES256', 'RS256'] });
      if (payload.role !== 'authenticated') throw new Error('Invalid session role');
      return IdSchema.parse(payload.sub);
    } catch { throw new HttpError(401, 'Sesi tidak valid atau sudah berakhir.'); }
  };
}
