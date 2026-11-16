import { z } from 'zod';
import { LIMITS } from './constants.js';
import { HttpsUrlSchema, IdSchema } from './common.js';

export const UploadQuerySchema = z.strictObject({ purpose: z.enum(['menu_photo', 'tenant_qris', 'floor_map']), owner_id: IdSchema });
export const UploadMetadataSchema = z.strictObject({
  mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  size_bytes: z.number().int().min(1).max(LIMITS.maxPhotoBytes),
});
export const UploadResponseSchema = z.strictObject({ asset_url: HttpsUrlSchema });
