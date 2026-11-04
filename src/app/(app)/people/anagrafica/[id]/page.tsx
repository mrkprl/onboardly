import { Suspense } from "react";
import { Spinner } from "@heroui/react";
import EmployeeProfile from "@/components/hr/EmployeeProfile";

export default function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="grid h-40 place-items-center">
          <Spinner />
        </div>
      }
    >
      <EmployeeProfile params={params} />
    </Suspense>
  );
}
