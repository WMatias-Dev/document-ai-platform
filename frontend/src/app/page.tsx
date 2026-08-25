import { HomeView } from "@/features/home/home-view";
import DashboardLayout from "./(dashboard)/layout";

export default function RootPage() {
  return (
    <DashboardLayout>
      <HomeView />
    </DashboardLayout>
  );
}
