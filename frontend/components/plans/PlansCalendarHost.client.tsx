"use client";

import * as React from "react";
import PlansCalendar, { PlansCalendarProps } from "./PlansCalendar.client";

type HostProps = {
  events: NonNullable<PlansCalendarProps["events"]>;
  /** ISO-строка даты, чтобы пропсы были сериализуемыми на сервере */
  initialMonthISO?: string;
};

export default function PlansCalendarHost({ events, initialMonthISO }: HostProps) {
  const initialMonth = React.useMemo(
    () => (initialMonthISO ? new Date(initialMonthISO) : undefined),
    [initialMonthISO]
  );

  return (
    <PlansCalendar
      events={events}
      initialMonth={initialMonth}
      onDayClick={(d) => console.log("day:", d)}
      onEventClick={(e) => console.log("event:", e)}
    />
  );
}