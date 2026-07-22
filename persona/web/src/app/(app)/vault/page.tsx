import { Suspense } from "react";
import { VaultView } from "@/components/vault/vault-view";

export default function VaultPage() {
  return (
    <Suspense>
      <VaultView />
    </Suspense>
  );
}
