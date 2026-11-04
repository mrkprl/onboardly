"use client";

import { useSyncExternalStore, type Key } from "react";
import { Tabs } from "@heroui/react";
import { useActiveInView } from "@/components/useActiveInView";
import DevicesPanel from "@/components/it/DevicesPanel";
import EmployeesPanel from "@/components/it/EmployeesPanel";
import LicensesPanel from "@/components/it/LicensesPanel";
import LogPanel from "@/components/it/LogPanel";
import RequestsPanel from "@/components/it/RequestsPanel";
import {
  useItParams,
  type DeviceView,
  type EmployeeView,
  type LicenseView,
  type LogView,
  type RequestView,
} from "@/components/it/shared";

const TABS = ["requests", "devices", "licenses", "employees", "log"] as const;

const noopSubscribe = () => () => {};

// L'indicatore di HeroUI anima dalla prima tab se è presente già in idratazione con un'altra tab selezionata
function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export default function ItTabs({
  requests,
  devices,
  licenses,
  employees,
  logs,
}: {
  requests: RequestView[];
  devices: DeviceView[];
  licenses: LicenseView[];
  employees: EmployeeView[];
  logs: LogView[];
}) {
  const { tab, filter, setTab, setFilter } = useItParams();
  const hydrated = useHydrated();
  const selected = TABS.includes(tab as (typeof TABS)[number]) ? tab : "requests";
  const openCount = requests.filter((r) => r.status !== "DONE").length;

  const labels: Record<(typeof TABS)[number], string> = {
    requests: openCount ? `Richieste (${openCount})` : "Richieste",
    devices: "Dispositivi",
    licenses: "Licenze",
    employees: "Dipendenti",
    log: "Log",
  };

  const tabsRef = useActiveInView<HTMLDivElement>('[role="tab"][aria-selected="true"]', selected);

  return (
    <div ref={tabsRef} id="sezioni-it" className="scroll-mt-4">
      <Tabs selectedKey={selected} onSelectionChange={(key: Key) => setTab(String(key))}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Sezioni IT">
            {TABS.map((id) => (
              <Tabs.Tab key={id} id={id} className="whitespace-nowrap">
                {labels[id]}
                {hydrated && <Tabs.Indicator />}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="requests" className="pt-4">
          <RequestsPanel requests={requests} filter={filter} onFilter={setFilter} />
        </Tabs.Panel>
        <Tabs.Panel id="devices" className="pt-4">
          <DevicesPanel devices={devices} filter={filter} onFilter={setFilter} />
        </Tabs.Panel>
        <Tabs.Panel id="licenses" className="pt-4">
          <LicensesPanel licenses={licenses} filter={filter} onFilter={setFilter} />
        </Tabs.Panel>
        <Tabs.Panel id="employees" className="pt-4">
          <EmployeesPanel employees={employees} filter={filter} onFilter={setFilter} />
        </Tabs.Panel>
        <Tabs.Panel id="log" className="pt-4">
          <LogPanel logs={logs} filter={filter} onFilter={setFilter} />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
