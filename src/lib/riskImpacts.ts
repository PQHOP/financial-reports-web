// "Why markets care" for /world-risks: hand-written rules linking an event
// type and place to the channel through which it reaches companies we cover.
// Deliberately narrow — only well-established links (a chokepoint's cargo, a
// Gulf hurricane's refineries, drought in a grain exporter), never a guess
// about a specific company's exposure. No model calls.
import type { RiskEvent } from "@/lib/worldRisks";

export type ImpactGroup = { role: string; tickers: string[] };
export type Impact = { why: string; groups: ImpactGroup[] };
// With tickers resolved to companies that have a published report.
export type ResolvedImpact = {
  why: string;
  groups: { role: string; companies: { ticker: string; href: string }[] }[];
};

const OIL_PRODUCERS = { role: "Oil producers (higher prices lift revenue)", tickers: ["XOM", "CVX", "COP", "OXY"] };
const REFINERS = { role: "Refiners (crude supply and cost)", tickers: ["VLO", "MPC", "PSX"] };
const AIRLINES = { role: "Airlines (jet fuel cost)", tickers: ["DAL", "UAL", "AAL", "LUV"] };
const LOGISTICS = { role: "Freight and logistics", tickers: ["FDX", "UPS", "EXPD", "CHRW"] };
const IMPORTERS = { role: "Retailers that import by sea (freight costs, delivery times)", tickers: ["WMT", "TGT", "HD", "NKE"] };
const GRAIN = { role: "Grain traders and processors", tickers: ["ADM", "BG"] };
const FERTILIZER = { role: "Fertilizer makers (global supply and prices)", tickers: ["CF", "MOS"] };
const CHIPS = { role: "Chip designers and device makers that rely on Taiwan-made chips", tickers: ["NVDA", "AAPL", "AMD", "QCOM"] };
const INSURERS = { role: "Property and casualty insurers (claims)", tickers: ["TRV", "ALL", "PGR", "CB", "AIG", "HIG"] };
const CRUISE = { role: "Cruise lines", tickers: ["CCL", "RCL", "NCLH"] };

const CHOKEPOINTS: Record<string, Impact> = {
  "Strait of Hormuz": {
    why: "Most of the oil and liquefied gas exported from the Persian Gulf (Saudi Arabia, Iraq, the UAE, Kuwait, Qatar, Iran) leaves through this strait; the US Energy Information Administration puts the oil flow at about a fifth of world consumption. Less traffic here tends to push oil and fuel prices up.",
    groups: [OIL_PRODUCERS, REFINERS, AIRLINES],
  },
  "Bab el-Mandeb Strait": {
    why: "The southern gate of the Red Sea, on the Asia–Europe route through the Suez Canal. Ships that avoid it sail around Africa's Cape of Good Hope instead, which adds one to two weeks and raises freight rates.",
    groups: [LOGISTICS, IMPORTERS],
  },
  "Suez Canal": {
    why: "The shortest sea route between Asia and Europe. Ships that avoid it sail around Africa's Cape of Good Hope instead, which adds one to two weeks and raises freight rates.",
    groups: [LOGISTICS, IMPORTERS],
  },
  "Panama Canal": {
    why: "Links US Gulf and East Coast ports with Asia. Low water or transit limits push US grain and gas exports and container ships onto longer routes.",
    groups: [GRAIN, LOGISTICS],
  },
  "Bosporus Strait": {
    why: "The only sea exit from the Black Sea: the route for grain from Ukraine and Russia, Russian fertilizer, and oil from Russia and Kazakhstan.",
    groups: [GRAIN, FERTILIZER],
  },
  "Kerch Strait": {
    why: "Connects the Sea of Azov to the Black Sea, a route for Russian and Ukrainian grain and fertilizer.",
    groups: [GRAIN, FERTILIZER],
  },
  "Taiwan Strait": {
    why: "The main shipping lane past Taiwan, where most of the world's most advanced chips are made, and a busy lane for China's coastal trade.",
    groups: [CHIPS, LOGISTICS],
  },
  "Malacca Strait": {
    why: "The shortest sea route between the Indian Ocean and East Asia, carrying much of China's, Japan's and South Korea's oil imports and Asia–Europe container trade.",
    groups: [LOGISTICS, REFINERS],
  },
};

const GRAIN_EXPORTERS = ["United States", "Brazil", "Argentina", "Ukraine", "Russia", "Canada", "Australia"];

function inGulfOfMexico(e: RiskEvent): boolean {
  return e.lon >= -98 && e.lon <= -80 && e.lat >= 18 && e.lat <= 31;
}

export function impactFor(e: RiskEvent): Impact | null {
  const severe = e.level === "red" || e.level === "orange";
  switch (e.layer) {
    case "chokepoint":
      // Only a real drop in traffic is news.
      if (e.level !== "down" && e.level !== "low") return null;
      return CHOKEPOINTS[e.title] ?? null;
    case "disaster":
      if (!severe || !e.current) return null;
      if (e.kind === "Tropical cyclone" && inGulfOfMexico(e)) {
        return {
          why: "A storm in the Gulf of Mexico can shut offshore oil platforms and the Gulf Coast refineries that make a large share of US fuel, and a landfall brings property claims.",
          groups: [REFINERS, INSURERS],
        };
      }
      if (["Tropical cyclone", "Flood", "Wildfire"].includes(e.kind) && e.place.includes("United States")) {
        return {
          why: "Severe weather in the United States turns into home, auto and commercial property claims for US insurers.",
          groups: [INSURERS],
        };
      }
      if (e.kind === "Drought" && GRAIN_EXPORTERS.some((c) => e.place.includes(c))) {
        return {
          why: "Drought in a major grain-exporting country cuts harvests, which moves crop prices and the volumes grain traders handle.",
          groups: [GRAIN],
        };
      }
      return null;
    case "quake": {
      const mag = parseFloat(e.title.slice(1));
      const alerted = e.level === "orange" || e.level === "red";
      if (/Taiwan$/.test(e.place) && (mag >= 6.5 || alerted)) {
        return {
          why: "A strong earthquake in Taiwan can pause chip factories that make most of the world's most advanced processors while equipment is checked.",
          groups: [CHIPS],
        };
      }
      return null;
    }
    case "outbreak":
      if (/cruise/i.test(e.title)) {
        return {
          why: "Outbreaks linked to cruise ships can bring port restrictions and cancellations and weigh on bookings.",
          groups: [CRUISE],
        };
      }
      return null;
  }
}

export function allImpactTickers(): string[] {
  const all = [
    OIL_PRODUCERS, REFINERS, AIRLINES, LOGISTICS, IMPORTERS, GRAIN, FERTILIZER, CHIPS, INSURERS, CRUISE,
  ].flatMap((g) => g.tickers);
  return [...new Set(all)];
}
