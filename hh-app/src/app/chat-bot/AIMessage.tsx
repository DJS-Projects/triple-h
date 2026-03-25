export default function AIMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-start">
      <div
        className="
          bg-[#635bff]
          text-white
          px-4 py-2
          rounded-xl rounded-bl-none
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
