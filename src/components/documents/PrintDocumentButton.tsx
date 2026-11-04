"use client";

import { Button } from "@heroui/react";
import { PrinterIcon } from "@phosphor-icons/react";

export default function PrintDocumentButton() {
  return (
    <Button onPress={() => window.print()}>
      <PrinterIcon size={16} />
      Stampa
    </Button>
  );
}
