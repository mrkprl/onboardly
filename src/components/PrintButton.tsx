"use client";

import { Button } from "@heroui/react";

export default function PrintButton() {
  return <Button onPress={() => window.print()}>Stampa etichetta</Button>;
}
