"use client";

import { useRef, useState } from "react";
import TrainingPlan from "@/components/training/TrainingPlan";
import SessionsPanel from "@/components/training/SessionsPanel";
import type { CourseOption, PlanItem, SessionView, StatusLabels } from "@/components/training/types";

export default function TrainingWorkspace({
  plan,
  sessions,
  courses,
  labels,
  alreadyEnrolled,
  awaitingRegistration,
  today,
}: {
  plan: PlanItem[];
  sessions: SessionView[];
  courses: CourseOption[];
  labels: StatusLabels;
  alreadyEnrolled: number;
  awaitingRegistration: number;
  today: string;
}) {
  const [form, setForm] = useState<{ open: boolean; courseId: string | null; key: number }>({
    open: false,
    courseId: null,
    key: 0,
  });
  const sessionsRef = useRef<HTMLElement>(null);

  const openForm = (courseId: string | null) => {
    setForm((f) => ({ open: true, courseId, key: f.key + 1 }));
    requestAnimationFrame(() => sessionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <>
      <TrainingPlan
        plan={plan}
        labels={labels}
        alreadyEnrolled={alreadyEnrolled}
        awaitingRegistration={awaitingRegistration}
        onCreateSession={openForm}
      />
      <SessionsPanel
        ref={sessionsRef}
        sessions={sessions}
        courses={courses}
        labels={labels}
        today={today}
        form={form}
        onOpenForm={() => openForm(null)}
        onCloseForm={() => setForm((f) => ({ ...f, open: false }))}
      />
    </>
  );
}
