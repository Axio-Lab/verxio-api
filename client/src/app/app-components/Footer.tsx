const footerLinks = {
  Marketplace: ["Explore Deals", "Popular Merchants"],
  Business: ["Merchant Dashboard", "Create Deal"],
  Company: ["About", "Support", "Terms", "Privacy"],
};

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-gray-100 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-lg font-semibold text-textPrimary">Verxio Deals</p>
            <p className="text-sm text-textSecondary">
              Discover, collect, and trade deals worldwide.
            </p>
          </div>
          <button className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-soft">
            Talk to us
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          {Object.entries(footerLinks).map(([section, links]) => (
            <div key={section}>
              <p className="text-sm font-semibold text-textPrimary">{section}</p>
              <ul className="mt-3 space-y-2 text-sm text-textSecondary">
                {links.map((link) => (
                  <li key={link} className="hover:text-textPrimary cursor-pointer">
                    {link}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center text-xs text-textSecondary">
          <span>© {new Date().getFullYear()} Verxio. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
