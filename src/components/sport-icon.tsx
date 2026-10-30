import { Bike, CircleDot, Dumbbell, Feather, Footprints, Swords, Target, Trophy, Waves, Weight, type LucideIcon } from "lucide-react";

// lucide's `Dribbble` is a brand glyph; a basketball-like circle reads better here.
const ICONS: Record<string, LucideIcon> = {
  trophy: Trophy,
  feather: Feather,
  dribbble: CircleDot,
  footprints: Footprints,
  "circle-dot": CircleDot,
  dumbbell: Dumbbell,
  weight: Weight,
  swords: Swords,
  bike: Bike,
  waves: Waves,
  target: Target,
};

export function SportIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Trophy;
  return <Icon aria-hidden className={className} />;
}
