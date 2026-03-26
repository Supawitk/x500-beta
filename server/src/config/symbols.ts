import { readFileSync } from "fs";
import { join } from "path";

interface Constituent {
  symbol: string;
  name: string;
  sector: string;
  subIndustry: string;
}

function loadConstituents(): Constituent[] {
  const csvPath = join(import.meta.dir, "constituents.csv");
  const raw = readFileSync(csvPath, "utf-8");
  const lines = raw.trim().split("\n").slice(1); // skip header
  const result: Constituent[] = [];

  for (const line of lines) {
    // Handle quoted fields (e.g. "Saint Paul, Minnesota")
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === "," && !inQuotes) { fields.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    fields.push(current.trim());

    if (fields.length >= 4 && fields[0]) {
      result.push({
        symbol: fields[0],
        name: fields[1],
        sector: fields[2],
        subIndustry: fields[3],
      });
    }
  }
  return result;
}

export const CONSTITUENTS = loadConstituents();
export const SP500_SYMBOLS = CONSTITUENTS.map(c => c.symbol);

// Pre-built lookup maps for instant sector/industry resolution
export const SECTOR_MAP: Record<string, string> = {};
export const INDUSTRY_MAP: Record<string, string> = {};
export const NAME_MAP: Record<string, string> = {};

for (const c of CONSTITUENTS) {
  SECTOR_MAP[c.symbol] = c.sector;
  INDUSTRY_MAP[c.symbol] = c.subIndustry;
  NAME_MAP[c.symbol] = c.name;
}
