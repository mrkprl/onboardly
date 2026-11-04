"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, TextArea } from "@heroui/react";
import { confirmShipmentAction } from "@/app/actions";

export default function ShipmentConfirmForm({
  token,
  today,
  minDate,
}: {
  token: string;
  today: string;
  minDate: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <Card.Header>
        <Card.Title>Conferma la spedizione</Card.Title>
      </Card.Header>
      <Card.Content>
        <form
          id="ship-form"
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            startTransition(async () => {
              const res = await confirmShipmentAction({
                token,
                shippedOn: String(data.get("shippedOn") ?? ""),
                note: String(data.get("note") ?? ""),
              });
              if (res.ok) router.refresh();
              else setError(res.error);
            });
          }}
        >
          <label className="flex flex-col gap-1 text-sm">
            Data di consegna al corriere
            <Input name="shippedOn" type="date" defaultValue={today} min={minDate} max={today} required />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Nota (facoltativa)
            <TextArea name="note" rows={2} maxLength={300} placeholder="Es. lasciato al punto di ritiro di via Roma" />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
        </form>
      </Card.Content>
      <Card.Footer className="justify-end">
        <Button type="submit" form="ship-form" isPending={isPending}>
          Ho spedito il pacco
        </Button>
      </Card.Footer>
    </Card>
  );
}
