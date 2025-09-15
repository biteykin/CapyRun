import "./globals.css";
import PHProvider from "./providers"; // default импорт
import { TooltipProvider } from "@/components/ui/tooltip";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ру" suppressHydrationWarning>
      <body className="min-h-[100svh]">
        <TooltipProvider delayDuration={250} skipDelayDuration={150}>
          <PHProvider>
            {children}
          </PHProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}