import "./globals.css";
import PHProvider from "./providers";
import { TooltipProvider } from "@/components/ui/tooltip";


export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <TooltipProvider delayDuration={250} skipDelayDuration={150}>
          <PHProvider>
            {children}
          </PHProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}