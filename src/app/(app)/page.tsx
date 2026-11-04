import { Suspense } from "react";
import { Spinner } from "@heroui/react";
import Overview from "@/components/overview/Overview";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="grid h-40 place-items-center">
          <Spinner />
        </div>
      }
    >
      <Overview />
    </Suspense>
  );
}
