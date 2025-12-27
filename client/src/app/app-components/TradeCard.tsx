import Link from "next/link";

type TradeCardProps = {
  id: string;
  voucher: string;
  seller: string;
  price: string;
  discount: string;
};

export default function TradeCard({ id, voucher, seller, price, discount }: TradeCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-md shadow-gray-900/10 transition-shadow hover:shadow-lg hover:shadow-gray-900/15 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm text-textSecondary">Voucher</p>
        <h3 className="text-lg font-semibold text-textPrimary">{voucher}</h3>
        <p className="text-sm text-textSecondary">Seller: {seller}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-primary">
          {discount} off
        </span>
        <span className="text-lg font-semibold text-textPrimary">{price}</span>
        <Link
          href={`/deals/${id}`}
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md shadow-gray-900/10 transition-transform hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gray-900/15"
        >
          Buy Voucher
        </Link>
      </div>
    </div>
  );
}
