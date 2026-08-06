import { ScreenTitle } from "../app/ui";
import { EarningsPanel } from "./EarningsPanel";
import { PayoutPanel } from "./PayoutPanel";

export function EarningsScreen() {
  return (
    <>
      <ScreenTitle hint="What you have, and where it came from">Earnings</ScreenTitle>
      <div className="flex flex-col gap-8">
        <EarningsPanel />
        <PayoutPanel />
      </div>
    </>
  );
}
