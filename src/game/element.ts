export type Element = "water" | "fire" | "wind" | "earth" | "metal";

export const ELEMENTS: Element[] = ["water", "fire", "wind", "earth", "metal"];

export function elementLabel(e: Element): string {
  switch (e) {
    case "water":
      return "Nước";
    case "fire":
      return "Lửa";
    case "wind":
      return "Gió";
    case "earth":
      return "Đất";
    case "metal":
      return "Kim loại";
  }
}

export function elementColor(e: Element): number {
  switch (e) {
    case "water":
      return 0x37b7ff;
    case "fire":
      return 0xff4b3a;
    case "wind":
      return 0xd7f5ff;
    case "earth":
      return 0xb08b4f;
    case "metal":
      return 0xc8d0da;
  }
}

// Simple 5-cycle advantage:
// water > fire > metal > wind > earth > water
const ADVANTAGE: Record<Element, Element> = {
  water: "fire",
  fire: "metal",
  metal: "wind",
  wind: "earth",
  earth: "water"
};

export function isAdvantaged(attacker: Element, defender: Element): boolean {
  return ADVANTAGE[attacker] === defender;
}

