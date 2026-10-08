export const categories = [
  "Smartphones",
  "Laptops",
  "Audio",
  "Gaming",
] as const;

export type ProductCategory = (typeof categories)[number];

export interface Product {
  id: string;
  name: string;
  subtitle: string;
  category: ProductCategory;
  price: number;
  originalPrice?: number;
  image: string;
  badge?: string;
  colors: { name: string; value: string }[];
  specs: string[];
  featured: boolean;
}

// Illustrative catalog. Confirm inventory, regional variants and prices before launch.
export const products: Product[] = [
  {
    id: "iphone-16-pro",
    name: "iPhone 16 Pro",
    subtitle: "256 GB · Natural Titanium",
    category: "Smartphones",
    price: 2399,
    image: "/images/hero-generated.png",
    badge: "Featured",
    colors: [{ name: "Natural Titanium", value: "#b9b2a7" }],
    specs: [
      "6.3-inch Super Retina XDR display",
      "A18 Pro chip",
      "256 GB storage",
      "48 MP Fusion camera",
    ],
    featured: true,
  },
  {
    id: "macbook-pro-m2",
    name: "MacBook Pro M2",
    subtitle: "13-inch · 8 GB / 256 GB",
    category: "Laptops",
    price: 2499,
    image: "/images/macbook.png",
    colors: [{ name: "Space Gray", value: "#8d8f91" }],
    specs: [
      "13.3-inch Retina display",
      "Apple M2 chip",
      "8 GB unified memory",
      "256 GB SSD",
    ],
    featured: true,
  },
  {
    id: "bose-qc45",
    name: "Bose QuietComfort 45",
    subtitle: "Wireless noise-cancelling headphones",
    category: "Audio",
    price: 549,
    image: "/images/headphones.png",
    colors: [{ name: "Midnight Blue", value: "#303848" }],
    specs: [
      "Active noise cancellation",
      "Bluetooth wireless audio",
      "Up to 24 hours of battery life",
      "USB-C charging",
    ],
    featured: true,
  },
  {
    id: "galaxy-s23",
    name: "Samsung Galaxy S23",
    subtitle: "128 GB · Lavender",
    category: "Smartphones",
    price: 1399,
    image: "/images/samsung.png",
    colors: [{ name: "Lavender", value: "#beb2cc" }],
    specs: [
      "6.1-inch Dynamic AMOLED 2X display",
      "128 GB storage",
      "50 MP wide camera",
      "Snapdragon 8 Gen 2 for Galaxy",
    ],
    featured: true,
  },
  {
    id: "airpods-pro-2",
    name: "AirPods Pro 2",
    subtitle: "Wireless earbuds · USB-C case",
    category: "Audio",
    price: 449,
    image: "/images/airpods.png",
    colors: [{ name: "White", value: "#f5f5f4" }],
    specs: [
      "Active noise cancellation",
      "Adaptive Audio",
      "USB-C MagSafe charging case",
      "Up to 6 hours of listening time",
    ],
    featured: true,
  },
  {
    id: "playstation-5-disc",
    name: "PlayStation 5",
    subtitle: "Disc edition · 825 GB",
    category: "Gaming",
    price: 1099,
    image: "/images/playstation.png",
    colors: [{ name: "White", value: "#e6e7e9" }],
    specs: [
      "825 GB SSD",
      "Ultra HD Blu-ray disc drive",
      "DualSense wireless controller",
      "4K gaming support",
    ],
    featured: true,
  },
];

export function getProduct(id: string): Product | undefined {
  return products.find((product) => product.id === id);
}

export function formatPrice(amount: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount)} ₼`;
}
