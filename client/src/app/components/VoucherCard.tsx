type VoucherCardProps = {
  merchant: string;
  discount: string;
  expiry: string;
  quantity?: number;
  tradeable?: boolean;
};

export default function VoucherCard({
  merchant,
  discount,
  expiry,
  quantity,
  tradeable,
}: VoucherCardProps) {
  return (
    <div className="card-surface flex flex-col gap-3 p-4 transition-transform hover:-translate-y-1">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-textSecondary">Voucher</p>
          <h3 className="text-lg font-semibold text-textPrimary">{merchant}</h3>
        </div>
        {tradeable ? (
          <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
            Tradeable
          </span>
        ) : null}
      </div>
      <p className="text-2xl font-bold text-primary">{discount}</p>
      <div className="flex items-center justify-between text-xs text-textSecondary">
        <span>Expires {expiry}</span>
        {quantity !== undefined ? <span>Qty: {quantity}</span> : null}
      </div>
      <div className="flex gap-2">
        <button className="flex-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-soft">
          Redeem
        </button>
        <button className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-textPrimary">
          Trade
        </button>
      </div>
    </div>
  );
}
