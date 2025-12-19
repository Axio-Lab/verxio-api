// Mock deals data for featured collections and deals on the landing page
export interface MappedDeal {
  id: string;
  title: string;
  merchant: string;
  discount: string;
  expiry: string;
  country?: string;
  category?: string;
  tradeable?: boolean;
  image?: string;
  worth?: number;
  worthSymbol?: string;
  quantityTotal?: number;
  quantityRemaining?: number;
  collectionAddress?: string;
}

export const mockDeals: MappedDeal[] = [
  {
    id: "nyc-spa",
    title: "Wellness & Spa Day",
    merchant: "Soho Serenity",
    discount: "40% OFF",
    expiry: "Nov 5",
    country: "USA",
    category: "Wellness",
    tradeable: true,
    image: "/deals/wellness-spa.jpg",
    worth: 75,
    worthSymbol: "USD",
    quantityTotal: 80,
    quantityRemaining: 45,
    collectionAddress: "mock-collection-address-1",
  },
  {
    id: "lisbon-brunch",
    title: "Brunch for Two",
    merchant: "Sunset Cafe",
    discount: "30% OFF",
    expiry: "Sep 28",
    country: "Portugal",
    category: "Dining",
    image: "/deals/brunch-dining.jpg",
    worth: 0,
    worthSymbol: "EUR",
    quantityTotal: 60,
    quantityRemaining: 5,
    collectionAddress: "mock-collection-address-2",
  },
  {
    id: "lagos-tech",
    title: "Cowork Day Pass",
    merchant: "CoLab Hub",
    discount: "20% OFF",
    expiry: "Aug 22 2026",
    country: "Nigeria",
    category: "Work",
    tradeable: true,
    image: "/deals/cowork-space.jpg",
    worth: 5000,
    worthSymbol: "NGN",
    quantityTotal: 200,
    quantityRemaining: 12,
    collectionAddress: "mock-collection-address-3",
  },
  {
    id: "dubai-retreat",
    title: "Luxury Spa Evening",
    merchant: "Azure Spa",
    discount: "45% OFF",
    expiry: "October 03 2026",
    country: "UAE",
    category: "Wellness",
    image: "/deals/luxury-spa.jpg",
    worth: 200,
    worthSymbol: "AED",
    quantityTotal: 90,
    quantityRemaining: 30,
    collectionAddress: "mock-collection-address-4",
  },
  {
    id: "berlin-techno",
    title: "Weekend Pass",
    merchant: "Club Echo",
    discount: "15% OFF",
    expiry: "Sep 14",
    country: "Germany",
    category: "Entertainment",
    image: "/deals/nightclub.jpg",
    worth: 0,
    worthSymbol: "EUR",
    quantityTotal: 50,
    quantityRemaining: 0,
    collectionAddress: "mock-collection-address-5",
  },
  {
    id: "sanmateo-coffee",
    title: "Specialty Coffee Flight",
    merchant: "Brew Lab",
    discount: "25% OFF",
    expiry: "Aug 30",
    country: "USA",
    category: "Food",
    image: "/deals/coffee-shop.jpg",
    worth: 25,
    worthSymbol: "USD",
    quantityTotal: 90,
    quantityRemaining: 70,
    collectionAddress: "mock-collection-address-6",
  },
  {
    id: "nairobi-safari",
    title: "Safari Day Trip",
    merchant: "Savannah Co.",
    discount: "35% OFF",
    expiry: "Nov 01",
    country: "Kenya",
    category: "Travel",
    tradeable: true,
    image: "/deals/safari-travel.jpg",
    worth: 15000,
    worthSymbol: "KES",
    quantityTotal: 120,
    quantityRemaining: 100,
    collectionAddress: "mock-collection-address-7",
  },
];
