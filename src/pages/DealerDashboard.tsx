import StationOverview from "./StationOverview";
/** Dealer: overview scoped to the dealer's own station only (enforced by RLS + branch filter). */
export default function DealerDashboard() {
  return <StationOverview />;
}
