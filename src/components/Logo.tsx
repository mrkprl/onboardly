import { DoorOpenIcon } from "@phosphor-icons/react/ssr";

export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[0.35em] text-foreground ${className}`}>
      <DoorOpenIcon className="h-[0.9em] w-auto" weight="bold" aria-hidden />
      <span className="font-medium tracking-tight">Onboardly</span>
    </span>
  );
}
