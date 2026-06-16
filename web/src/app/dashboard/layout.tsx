import { UserProvider } from "@/context/user-context";
import { Sidebar } from "./sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      <Sidebar>{children}</Sidebar>
    </UserProvider>
  );
}
