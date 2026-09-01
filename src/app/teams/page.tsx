import { redirect } from "next/navigation";

// The old Teams index (grouped-by-player team table) was replaced by the
// Stats tab. /teams/[abbr] team-detail pages still work and are linked from
// Standings/Stats - this bare index just sends anyone with an old bookmark
// or the /teams link to the new tab.
export default function TeamsIndexRedirect() {
  redirect("/stats");
}
