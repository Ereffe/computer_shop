import fs from "fs";
import path from "path";

type ProductType = "cpu" | "gpu" | "ram" | "disk";

type Product = {
  id: number;
  code: string;
  name: string;
  type: ProductType;
  price: number;
  amount: number;
  description: string;
  date: string;
  image: string;
};

const SEED = 123456;
const PRODUCT_COUNT = 100;

let seed = SEED;

function random(): number {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}

function randomInt(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

function randomItem<T>(items: T[]): T {
  return items[randomInt(0, items.length - 1)];
}

function generateCode(id: number): string {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  let code = "";

  const idPart = id.toString().padStart(5, "0");

  code += idPart;

  while (code.length < 10) {
    code += characters[randomInt(0, characters.length - 1)];
  }

  return code.slice(0, 10);
}

const productsByType: Record<
  ProductType,
  {
    names: string[];
    descriptions: string[];
    minPrice: number;
    maxPrice: number;
  }
> = {
  cpu: {
    names: [
      "Intel Core i5",
      "Intel Core i7",
      "Intel Core i9",
      "AMD Ryzen 5",
      "AMD Ryzen 7",
      "AMD Ryzen 9",
    ],
    descriptions: [
      "Wydajny procesor do komputera stacjonarnego.",
      "Procesor przeznaczony do pracy i codziennego użytkowania.",
      "Wysokowydajny procesor dla wymagających użytkowników.",
    ],
    minPrice: 45000,
    maxPrice: 250000,
  },

  gpu: {
    names: [
      "NVIDIA GeForce RTX 4060",
      "NVIDIA GeForce RTX 4070",
      "NVIDIA GeForce RTX 4080",
      "AMD Radeon RX 7600",
      "AMD Radeon RX 7800",
      "AMD Radeon RX 7900",
    ],
    descriptions: [
      "Karta graficzna przeznaczona do gier i multimediów.",
      "Wydajna karta graficzna dla wymagających użytkowników.",
      "Karta graficzna zapewniająca wysoką wydajność w grach.",
    ],
    minPrice: 120000,
    maxPrice: 600000,
  },

  ram: {
    names: [
      "Kingston Fury 16GB",
      "Kingston Fury 32GB",
      "Corsair Vengeance 16GB",
      "Corsair Vengeance 32GB",
      "G.Skill Ripjaws 16GB",
      "G.Skill Ripjaws 32GB",
    ],
    descriptions: [
      "Pamięć RAM do komputerów stacjonarnych.",
      "Szybka pamięć operacyjna do codziennego użytkowania.",
      "Wydajny zestaw pamięci RAM dla wymagających aplikacji.",
    ],
    minPrice: 12000,
    maxPrice: 90000,
  },

  disk: {
    names: [
      "Samsung SSD 1TB",
      "Samsung SSD 2TB",
      "WD Blue 1TB",
      "WD Black 2TB",
      "Kingston NV2 1TB",
      "Kingston NV2 2TB",
    ],
    descriptions: [
      "Szybki dysk SSD do komputera stacjonarnego.",
      "Dysk zapewniający szybki dostęp do danych.",
      "Wydajny dysk NVMe do systemu i aplikacji.",
    ],
    minPrice: 18000,
    maxPrice: 180000,
  },
};

const types: ProductType[] = ["cpu", "gpu", "ram", "disk"];

function generateDate(): string {
  const start = new Date("2026-01-01T00:00:00Z").getTime();
  const end = new Date("2026-10-01T00:00:00Z").getTime();

  const timestamp = randomInt(start, end);

  return new Date(timestamp).toISOString();
}

function generateProduct(id: number, type: ProductType): Product {
  const data = productsByType[type];

  return {
    id,
    code: generateCode(id),
    name: randomItem(data.names),
    type,
    price: randomInt(data.minPrice, data.maxPrice),
    amount: randomInt(0, 50),
    description: randomItem(data.descriptions),
    date: generateDate(),
    image: `/images/products/${type}.webp`,
  };
}

const products: Product[] = [];

for (let i = 0; i < types.length; i++) {
  products.push(generateProduct(i + 1, types[i]));
}

for (let id = types.length + 1; id <= PRODUCT_COUNT; id++) {
  const type = randomItem(types);

  products.push(generateProduct(id, type));
}

products[10].amount = 0;
products[25].amount = 0;
products[50].amount = 0;
products[75].amount = 0;

const outputPath = path.join(process.cwd(), "data", "products.json");


fs.mkdirSync(path.dirname(outputPath), {
  recursive: true,
});

fs.writeFileSync(
  outputPath,
  JSON.stringify(products, null, 2),
  "utf-8"
);

console.log(`Generated ${products.length} products.`);
console.log(`Seed: ${SEED}`);
console.log(`Output: ${outputPath}`);