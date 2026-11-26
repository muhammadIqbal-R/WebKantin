import type { OrderFulfillment } from '@kantin/shared';

export function FulfillmentDetails({ details }: { details: OrderFulfillment | undefined }) {
  if (!details) return null;
  return <dl className="stack small">
    {details.table_number && <div className="row wrap">
      <dt className="muted">Nomor meja</dt><dd><strong>{details.table_number}</strong></dd>
    </div>}
    {details.pickup_note && <div>
      <dt className="muted">Catatan untuk tenant</dt>
      <dd className="fulfillment-note">{details.pickup_note}</dd>
    </div>}
  </dl>;
}
