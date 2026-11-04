"use client";

import { useSyncExternalStore, type Key, type ReactNode } from "react";
import { Tabs } from "@heroui/react";
import { useActiveInView } from "@/components/useActiveInView";
import { useHrParams } from "@/components/hr/useHrParams";

const TABS = ["dati", "presenze", "formazione", "documenti"] as const;
type TabId = (typeof TABS)[number];

const noopSubscribe = () => () => {};

// Come in ItTabs: l'indicatore va montato solo dopo l'idratazione per non animare dalla prima tab
function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export default function ProfileTabs({
  labels,
  panels,
}: {
  labels: Record<TabId, string>;
  panels: Record<TabId, ReactNode>;
}) {
  const { get, update } = useHrParams();
  const hydrated = useHydrated();
  const tab = get("tab");
  const selected: TabId = TABS.includes(tab as TabId) ? (tab as TabId) : "dati";

  const tabsRef = useActiveInView<HTMLDivElement>('[role="tab"][aria-selected="true"]', selected);

  return (
    <div ref={tabsRef}>
      <Tabs selectedKey={selected} onSelectionChange={(key: Key) => update({ tab: key === "dati" ? null : String(key) })}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Sezioni del profilo">
            {TABS.map((id) => (
              <Tabs.Tab key={id} id={id} className="whitespace-nowrap">
                {labels[id]}
                {hydrated && <Tabs.Indicator />}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
        {TABS.map((id) => (
          <Tabs.Panel key={id} id={id} className="pt-4">
            {panels[id]}
          </Tabs.Panel>
        ))}
      </Tabs>
    </div>
  );
}
