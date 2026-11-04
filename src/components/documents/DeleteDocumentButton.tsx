"use client";

import { useState } from "react";
import { Button } from "@heroui/react";
import { deleteDocumentAction } from "@/app/(app)/people/documenti/actions";
import { ActionButton } from "@/components/it/shared";

export default function DeleteDocumentButton({ documentId, title }: { documentId: string; title: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button size="sm" variant="ghost" aria-label={`Elimina ${title}`} onPress={() => setConfirming(true)}>
        Elimina
      </Button>
    );
  }
  return (
    <span className="inline-flex items-start gap-1">
      <Button size="sm" variant="ghost" onPress={() => setConfirming(false)}>
        No
      </Button>
      <ActionButton variant="danger-soft" action={() => deleteDocumentAction(documentId)}>
        Conferma
      </ActionButton>
    </span>
  );
}
