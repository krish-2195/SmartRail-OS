import { useEffect, useState } from "react";
import { TRAINS, type Train } from "@/lib/mock/data";
import { useTrains } from "@/lib/api/hooks";

// Live train state. Reads from trains query with local second-by-second countdown ticks.
export function useLiveTrains(): Train[] {
  const trainsQuery = useTrains();
  const [trains, setTrains] = useState<Train[]>(() => trainsQuery.data && trainsQuery.data.length > 0 ? trainsQuery.data : TRAINS);

  useEffect(() => {
    if (trainsQuery.data) {
      // Filter out AT_STATION trains whose departure ETA has already elapsed
      const fresh = trainsQuery.data.filter((t) => {
        if (t.status === "At Station" && (t.departureEtaSeconds ?? t.etaSeconds) <= 0) {
          return false;
        }
        return true;
      });
      setTrains(fresh);
    }
  }, [trainsQuery.data]);

  // Tick departureEtaSeconds and arrivalEtaSeconds down by 1 every second
  useEffect(() => {
    const id = setInterval(() => {
      setTrains((prev) =>
        prev.map((t) => {
          if (t.status === "At Station" && t.departureEtaSeconds != null) {
            const next = Math.max(0, t.departureEtaSeconds - 1);
            return next === t.departureEtaSeconds ? t : { ...t, departureEtaSeconds: next, etaSeconds: next };
          }
          if (t.arrivalEtaSeconds != null) {
            const next = Math.max(0, t.arrivalEtaSeconds - 1);
            return next === t.arrivalEtaSeconds ? t : { ...t, arrivalEtaSeconds: next, etaSeconds: next };
          }
          const eta = Math.max(0, t.etaSeconds - 1);
          return eta === t.etaSeconds ? t : { ...t, etaSeconds: eta };
        })
      );
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return trains;
}
