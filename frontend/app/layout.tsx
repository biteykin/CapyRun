import "./globals.css";
import Sidebar from "../components/Sidebar";

export const metadata = {
  title: "CapyRun",
  description: "CapyRun front-end",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-[#0b0f19] text-neutral-100">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
