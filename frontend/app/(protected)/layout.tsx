import Shell from "@/components/Shell";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}