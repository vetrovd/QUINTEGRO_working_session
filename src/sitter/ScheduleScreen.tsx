import { ScreenTitle } from "../app/ui";
import { VisitSchedule } from "./VisitSchedule";

export function ScheduleScreen() {
  return (
    <>
      <ScreenTitle hint="Every booking, laid out by time">Schedule</ScreenTitle>
      <VisitSchedule />
    </>
  );
}
