const stroke = { stroke: "currentColor", strokeWidth: "1.5" } as const;

export function BoldIcon() {
  return (
    <svg fill="none" height="16" viewBox="0 0 16 16" width="16" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M3.82666 8H8.83317C10.3059 8 11.4998 6.80609 11.4998 5.33333V5.16667C11.4998 3.69391 10.3059 2.5 8.83317 2.5H4.82666C4.27438 2.5 3.82666 2.94772 3.82666 3.5V8ZM3.82666 8V12.5C3.82666 13.0523 4.27438 13.5 4.82666 13.5H8.33317M8.66666 13.5H9.49999C10.9728 13.5 12.1667 12.3061 12.1667 10.8333V10.6667C12.1667 9.19391 10.9728 8 9.49999 8H8.66666"
        strokeLinecap="square"
        strokeLinejoin="round"
        {...stroke}
      />
    </svg>
  );
}

export function ItalicIcon() {
  return (
    <svg fill="none" height="16" viewBox="0 0 16 16" width="16" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6.49984 2.5L9.6665 2.5M12.8332 2.5L9.6665 2.5M9.6665 2.5L6.33317 13.5M6.33317 13.5H3.1665M6.33317 13.5L9.50656 13.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...stroke}
      />
    </svg>
  );
}

export function UnderlineIcon() {
  return (
    <svg fill="none" height="16" viewBox="0 0 16 16" width="16" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M3.8335 13.8333H12.1668M3.8335 2.5V8C3.8335 10.3012 5.69898 12.1667 8.00016 12.1667C10.3013 12.1667 12.1668 10.3012 12.1668 8V2.5"
        strokeLinecap="round"
        {...stroke}
      />
    </svg>
  );
}

function BlockIcon({ d }: { d: string }) {
  return (
    <svg fill="none" height="20" viewBox="0 0 20 20" width="20" xmlns="http://www.w3.org/2000/svg">
      <path d={d} stroke="black" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.32" strokeWidth="1.5" />
    </svg>
  );
}

export const HeadingOneIcon = () => (
  <BlockIcon d="M3.8335 5.16602V9.99935M3.8335 14.8327V9.99935M10.8335 5.16602V9.99935M10.8335 14.8327V9.99935M10.8335 9.99935H3.8335M14.0002 10.9993L16.1668 9.16602V14.8327" />
);
export const HeadingTwoIcon = () => (
  <BlockIcon d="M10.8335 5.16602V9.99935M10.8335 9.99935V14.8327M10.8335 9.99935H3.8335M3.8335 5.16602V9.99935M3.8335 9.99935V14.8327M16.8335 14.8327H13.8335L16.4546 11.6936C16.6987 11.4343 16.8335 11.013 16.8335 10.666C16.8335 9.88361 16.2404 9.16602 15.3335 9.16602C14.7783 9.16602 14.2935 9.45091 14.0342 9.87435C13.9737 9.98103 13.9315 10.1031 13.902 10.2216" />
);
export const TextIcon = () => <BlockIcon d="M4.5 6.16667V4.5H10M15.5 6.16667V4.5H10M10 4.5V15.5M10 15.5H8.5M10 15.5H11.5" />;
