import type { VisitId } from "../domain/types";
import { ScreenTitle } from "../app/ui";
import { VisitSchedule } from "./VisitSchedule";

export function ScheduleScreen({ focusVisitId }: { focusVisitId?: VisitId }) {
  return (
    <>
      <ScreenTitle hint="Every booking laid out by time — the pet's instructions are on each card">
        Schedule
      </ScreenTitle>
      <VisitSchedule focusVisitId={focusVisitId} />
    </>
  );
}
