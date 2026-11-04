"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@heroui/react";
import { loginAction, type LoginState } from "@/app/(auth)/login/actions";

export default function LoginForm() {
  const next = useSearchParams().get("next") ?? "/";
  const [state, action, isPending] = useActionState<LoginState, FormData>(loginAction, { error: null });

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" isPending={isPending} fullWidth>
        Entra nella demo
      </Button>
    </form>
  );
}
