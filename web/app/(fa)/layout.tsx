import { Shell, metadataFor } from "@/components/shell";
export const metadata = metadataFor("fa");
export default function Layout({ children }: { children: React.ReactNode }) {
  return <Shell lang="fa">{children}</Shell>;
}
