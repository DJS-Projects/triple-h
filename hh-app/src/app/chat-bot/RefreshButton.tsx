import { RefreshCw } from "lucide-react";

export default function RefreshButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="m-[5px] p-[5px] rounded-full text-gray-400 hover:bg-[#635bff] hover:text-white cursor-pointer transition"
    >
      <RefreshCw className="w-6 h-6" />
    </button>
  );
}
