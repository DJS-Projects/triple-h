export default function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div
        className="
          bg-[#eaeaea] 
          text-gray-800 
          px-4 py-2 
          rounded-xl rounded-br-none 
          max-w-[75%] 
          whitespace-pre-wrap 
          break-words
        "
      >
        {text}
      </div>
    </div>
  );
}