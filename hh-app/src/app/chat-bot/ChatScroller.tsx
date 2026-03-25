export default function ChatScroller({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 p-4 h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
      {children}
    </div>
  );
}
