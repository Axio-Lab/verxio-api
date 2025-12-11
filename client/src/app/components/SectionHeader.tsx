type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
};

export default function SectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
}: SectionHeaderProps) {
  return (
    <div className={`space-y-2 ${align === "center" ? "text-center" : ""}`}>
      {eyebrow ? (
        <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-primary">
          {eyebrow}
        </span>
      ) : null}
      <h2 className="text-2xl font-semibold text-textPrimary sm:text-3xl">{title}</h2>
      {description ? (
        <p className="text-sm text-textSecondary sm:text-base">{description}</p>
      ) : null}
    </div>
  );
}
