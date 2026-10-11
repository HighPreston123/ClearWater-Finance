import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { useFinanceStore } from "@/store/FinanceStore";
import { PageHeader, GlassCard, CardTitle } from "@/components/common/Glass";
import { DataConnections } from "@/components/settings/DataConnections";
import { CsvImportCard } from "@/components/settings/CsvImportCard";
import { HoldingsImportCard } from "@/components/settings/HoldingsImportCard";
import { ReferenceDiagnostics } from "@/components/settings/ReferenceDiagnostics";
import { DeleteAccountCard } from "@/components/settings/DeleteAccountCard";
import { TwoFactorCard } from "@/components/settings/TwoFactorCard";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Clearwater" },
      { name: "description", content: "Data connections and data controls." },
      { property: "og:title", content: "Settings — Clearwater" },
      { property: "og:description", content: "Data connections and data controls." },
    ],
  }),
  component: Settings,
});

function Settings() {
  const { resetDemo } = useFinanceStore();
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" />
      <DataConnections />
      <CsvImportCard />
      <HoldingsImportCard />
      <ReferenceDiagnostics />
      <TwoFactorCard />
      <GlassCard>
        <CardTitle>Clear data</CardTitle>
        <p className="text-sm">Clearing removes all your transactions, holdings, and manual inputs so you can start from a blank slate.</p>
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="destructive" className="mt-3 rounded-full"><RotateCcw /> Clear all data</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear all your data?</AlertDialogTitle>
              <AlertDialogDescription>This removes your transactions, recurring labels, holdings, and manual inputs. It cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => { resetDemo(); toast.success("All data cleared"); }}>Clear</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </GlassCard>
      <DeleteAccountCard />
    </div>
  );
}
