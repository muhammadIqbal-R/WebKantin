export const ORDER_STATUSES = [
  'menunggu_bayar', 'menunggu_konfirmasi', 'diproses', 'siap', 'selesai', 'dibatalkan',
] as const;
export const PAYMENT_STATUSES = ['unpaid', 'pending_confirmation', 'paid', 'rejected'] as const;
export const ORDER_TYPES = ['dine_in', 'take_away'] as const;
export const PAYMENT_METHODS = ['qris_static'] as const;
export const ROLES = ['admin_pengelola', 'tenant'] as const;

// Draft business limits; review with the product owner before implementation.
export const LIMITS = {
  maxMoneyIdr: 1_000_000_000,
  maxQuantity: 99,
  maxCartLines: 100,
  maxPhotoBytes: 2 * 1024 * 1024,
  maxPageSize: 100,
} as const;

// Allowed destinations; API must also check actor, payment state and version.
export const ORDER_TRANSITIONS = {
  menunggu_bayar: ['menunggu_konfirmasi', 'dibatalkan'],
  menunggu_konfirmasi: ['diproses', 'menunggu_bayar', 'dibatalkan'],
  diproses: ['siap'],
  siap: ['selesai'],
  selesai: [],
  dibatalkan: [],
} as const satisfies Record<(typeof ORDER_STATUSES)[number], readonly (typeof ORDER_STATUSES)[number][]>;
