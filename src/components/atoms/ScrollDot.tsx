export function ScrollDot({ label }: { label: string }) {
  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center text-white/80">
      <div className="mx-auto mb-2 h-10 w-6 rounded-full border-2 border-white/40">
        <div className="mx-auto mt-1.5 h-1.5 w-1 rounded-full bg-white animate-scroll-dot" />
      </div>
      <span className="text-xs tracking-wide">{label}</span>
    </div>
  );
}
