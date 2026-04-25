interface CircularLoaderProps {
  text: string;
  color: string;
}

export default function CircularLoader({ text, color }: CircularLoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-4 z-50">
      <style>{`
        .loader-rotate { animation: loader-rotate 2s linear infinite; }
        @keyframes loader-rotate {
          0% { transform: rotate(90deg); box-shadow: 0 10px 20px 0 #fff inset, 0 20px 30px 0 #ad5fff inset, 0 60px 60px 0 #471eec inset; }
          50% { transform: rotate(270deg); box-shadow: 0 10px 20px 0 #fff inset, 0 20px 10px 0 #d60a47 inset, 0 40px 60px 0 #311e80 inset; }
          100% { transform: rotate(450deg); box-shadow: 0 10px 20px 0 #fff inset, 0 20px 30px 0 #ad5fff inset, 0 60px 60px 0 #471eec inset; }
        }
        .loader-letter { display: inline-block; opacity: 0.4; transform: translateY(0); animation: loader-letter-anim 2s infinite; }
        .loader-letter:nth-child(1) { animation-delay: 0s; } .loader-letter:nth-child(2) { animation-delay: 0.1s; }
        .loader-letter:nth-child(3) { animation-delay: 0.2s; } .loader-letter:nth-child(4) { animation-delay: 0.3s; }
        .loader-letter:nth-child(5) { animation-delay: 0.4s; } .loader-letter:nth-child(6) { animation-delay: 0.5s; }
        .loader-letter:nth-child(7) { animation-delay: 0.6s; } .loader-letter:nth-child(8) { animation-delay: 0.7s; }
        .loader-letter:nth-child(9) { animation-delay: 0.8s; }
        @keyframes loader-letter-anim {
          0%, 100% { opacity: 0.4; transform: translateY(0); }
          20% { opacity: 1; transform: scale(1.15); }
          40% { opacity: 0.7; transform: translateY(0); }
        }
      `}</style>
      <div className="loader-wrapper relative flex items-center justify-center w-[100px] h-[100px] sm:w-[120px] sm:h-[120px] font-['Inter',sans-serif] text-white rounded-full bg-transparent select-none scale-90 sm:scale-100">
        <div className="loader absolute top-0 left-0 w-full h-full rounded-full bg-transparent loader-rotate" />
        <div className="z-10 flex gap-0.5">
          {["G","E","N","E","R","A","T","I","N","G"].map((letter, i) => (
            <span key={i} className="loader-letter text-[10px] sm:text-xs font-bold drop-shadow-md shadow-black">{letter}</span>
          ))}
        </div>
      </div>
      {text && (
        <p className="text-sm font-bold text-center drop-shadow-md" style={{ color: color }}>
          {text}
        </p>
      )}
    </div>
  );
}
