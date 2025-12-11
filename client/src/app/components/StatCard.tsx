type StatCardProps = {
  label: string;
  value: string;
  trend?: string;
};

export default function StatCard({ label, value, trend }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card">
      <p className="text-sm text-textSecondary">{label}</p>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-2xl font-semibold text-textPrimary">{value}</p>
        {trend ? (
          <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
            {trend}
          </span>
        ) : null}
      </div>
    </div>
  );
}
