import { Suspense } from "react";
import PeopleNav, { PeopleNavStatic } from "@/components/PeopleNav";

export default function PeopleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <Suspense fallback={<PeopleNavStatic />}>
          <PeopleNav />
        </Suspense>
      </div>
      {children}
    </div>
  );
}
