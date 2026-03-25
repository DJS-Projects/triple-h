import { Send } from "lucide-react";

interface MessageBarProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSend: () => void;
}

export default function MessageBar({ value, onChange, onSend }: MessageBarProps) {
  return (
    <div className="text-m flex items-center gap-2 border border-gray-300 rounded-full px-4 py-2 focus-within:border-[#635bff] transition-colors">
      <input
        type="text"
        placeholder="Ask our AI about neurodivergent talent..."
        value={value}
        onChange={onChange}
        className="flex-grow bg-transparent outline-none text-gray-700 placeholder-gray-400"
        onKeyDown={(e) => e.key === "Enter" && onSend()}
      />
      <button
        onClick={onSend}
        className="p-[7px] rounded-full text-gray-400 hover:bg-[#635bff] hover:text-white cursor-pointer transition-colors duration-200"
      >
        <Send className="w-5 h-5 transform -translate-x-[1px]" />
      </button>
    </div>
  );
}
