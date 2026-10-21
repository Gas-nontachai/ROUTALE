import { Leaf, Trees } from 'lucide-react';

export const Footer = () => {
  return (
    <footer
      className="
        flex w-full shrink-0
        items-center justify-between
        gap-3 border-t border-[#DCE4D3]
        bg-[#F7F7EF]
        px-5 py-3
        text-[10px] font-semibold
        tracking-[0.08em] text-[#87947B]
        lg:px-10
      "
    >
      {/* Left: Brand tagline */}
      <div className="flex shrink-0 items-center gap-2">
        <Trees size={15} strokeWidth={1.8} className="text-[#718D69]" />
        <span className="uppercase">Made for the wanderers.</span>
      </div>

      {/* Center: Message */}
      <div
        className="
          hidden items-center gap-2
          text-center normal-case
          tracking-normal md:flex
        "
      >
        <span>A little less scrolling. A little more exploring.</span>
        <Leaf size={13} className="text-[#718D69]" />
      </div>

      {/* Right: Version */}
      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden uppercase sm:inline">Frontend only</span>

        <span className="hidden text-[#9DB28D] sm:inline">◆</span>

        <span className="uppercase">3D Journey 1.3</span>
      </div>
    </footer>
  );
};
