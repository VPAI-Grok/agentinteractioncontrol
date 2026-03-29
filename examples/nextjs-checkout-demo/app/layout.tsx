import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          background:
            "linear-gradient(180deg, #fff8f0 0%, #fff4e6 35%, #f8fafc 100%)",
          color: "#1c1917",
          fontFamily: "Georgia, serif",
          margin: 0
        }}
      >
        {children}
      </body>
    </html>
  );
}
