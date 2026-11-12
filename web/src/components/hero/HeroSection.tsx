import { HeroCanvas } from "./HeroCanvas";
import { HeroCoordinates } from "./HeroCoordinates";

export function HeroSection() {
  return (
    <div className="relative overflow-x-clip h-[1460px] select-none isolate">
      <HeroCanvas />
      <HeroCoordinates />
      <div className="w-full left-0 h-[1080px] absolute top-942 z-[9]" style={{ background: "linear-gradient(180deg, transparent 0%, #FFF 32.02%)" }} />
    </div>
  );
}
