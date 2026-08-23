
export type LineId = "blue" | "red";

export interface Station {
  id: string;
  name: string;
  line: LineId;
  order: number;
}

export const BLUE_LINE: Station[] = [
  { id: "BL01", name: "Vastral Gam", line: "blue", order: 1 },
  { id: "BL02", name: "Nirant Cross Road", line: "blue", order: 2 },
  { id: "BL03", name: "Vastral", line: "blue", order: 3 },
  { id: "BL04", name: "Rabari Colony", line: "blue", order: 4 },
  { id: "BL05", name: "Amraivadi", line: "blue", order: 5 },
  { id: "BL06", name: "Apparel Park", line: "blue", order: 6 },
  { id: "BL07", name: "Kankaria East", line: "blue", order: 7 },
  { id: "BL08", name: "Kalupur Metro Station", line: "blue", order: 8 },
  { id: "BL09", name: "Ghee Kanta", line: "blue", order: 9 },
  { id: "BL10", name: "Shahpur", line: "blue", order: 10 },
  { id: "BL11", name: "Old High Court", line: "blue", order: 11 },
  { id: "BL12", name: "S P Stadium", line: "blue", order: 12 },
  { id: "BL13", name: "Commerce Six Road", line: "blue", order: 13 },
  { id: "BL14", name: "Gujarat University", line: "blue", order: 14 },
  { id: "BL15", name: "Gurukul Road", line: "blue", order: 15 },
  { id: "BL16", name: "Doordarshan Kendra", line: "blue", order: 16 },
  { id: "BL17", name: "Thaltej", line: "blue", order: 17 },
  { id: "BL18", name: "Thaltej Gam", line: "blue", order: 18 },
];

export const RED_LINE: Station[] = [
  { id: "RL01", name: "APMC", line: "red", order: 1 },
  { id: "RL02", name: "Jivraj Park", line: "red", order: 2 },
  { id: "RL03", name: "Rajivnagar", line: "red", order: 3 },
  { id: "RL04", name: "Shreyas", line: "red", order: 4 },
  { id: "RL05", name: "Paldi", line: "red", order: 5 },
  { id: "RL06", name: "Gandhigram", line: "red", order: 6 },
  { id: "RL07", name: "Old High Court", line: "red", order: 7 },
  { id: "RL08", name: "Usmanpura", line: "red", order: 8 },
  { id: "RL09", name: "Vijay Nagar", line: "red", order: 9 },
  { id: "RL10", name: "Vadaj", line: "red", order: 10 },
  { id: "RL11", name: "Ranip", line: "red", order: 11 },
  { id: "RL12", name: "Sabarmati Rly Station", line: "red", order: 12 },
  { id: "RL13", name: "AEC", line: "red", order: 13 },
  { id: "RL14", name: "Sabarmati", line: "red", order: 14 },
  { id: "RL15", name: "Motera Stadium", line: "red", order: 13 },
];

export const STATIONS = [...BLUE_LINE, ...RED_LINE];
export const CURRENT_STATION = "COMMAND CENTER";

export type CoachStatus = "low" | "moderate" | "high" | "critical";
export interface Coach {
  id: string;
  label: string;
  capacity: number;
  occupancy: number; // 0-100
  passengers?: number;
  estimatedOccupancy?: number;
  estimatedPassengers?: number;
}

export function statusFromOccupancy(pct: number): CoachStatus {
  if (pct < 50) return "low";
  if (pct < 75) return "moderate";
  if (pct < 90) return "high";
  return "critical";
}

export const OCC_TW: Record<CoachStatus, string> = {
  low: "bg-success",
  moderate: "bg-warning",
  high: "bg-orange-500",
  critical: "bg-danger",
};

export const OCC_TEXT: Record<CoachStatus, string> = {
  low: "text-success",
  moderate: "text-warning",
  high: "text-orange-400",
  critical: "text-danger",
};

export type RiskLevel = "Low" | "Moderate" | "High" | "Critical";

export interface Train {
  id: string;
  name: string;
  line: LineId;
  direction: string;
  originId: string;
  destinationId: string;
  currentStationId: string;
  nextStationId: string;
  arrival: string;
  departure: string;
  etaSeconds: number;
  /** Seconds until this train departs the current station (only set when status = AT_STATION) */
  departureEtaSeconds?: number | null;
  /** Seconds until this train arrives at the next station (only set when status = IN_TRANSIT) */
  arrivalEtaSeconds?: number | null;
  predictedBoarding: number;
  predictedDeboarding: number;
  predictedOccupancy?: number;
  coaches: Coach[];
  status: "Approaching" | "At Station" | "Departing" | "En Route";
  journey_completed_pct?: number;
  estimatedDeparturePassengers?: number;
  estimatedDepartureOccupancy?: number;
}

export const TRAINS: Train[] = [
  {
    id: "BL-UP-001",
    name: "BL-UP-001 · Vastral Express",
    line: "blue",
    direction: "Vastral Gam Bound",
    originId: "bl-1",
    destinationId: "bl-14",
    currentStationId: "bl-7",
    nextStationId: "bl-8",
    arrival: "14:42",
    departure: "14:44",
    etaSeconds: 160,
    predictedBoarding: 142,
    predictedDeboarding: 88,
    status: "Approaching",
    coaches: [
      { id: "c1", label: "Coach 1", capacity: 280, occupancy: 38 },
      { id: "cL", label: "Ladies Coach", capacity: 240, occupancy: 64 },
      { id: "c3", label: "Coach 3", capacity: 280, occupancy: 92 },
    ],
  },
  {
    id: "BL-DN-014",
    name: "BL-DN-014 · Thaltej Express",
    line: "blue",
    direction: "Thaltej Gam Bound",
    originId: "bl-14",
    destinationId: "bl-1",
    currentStationId: "bl-8",
    nextStationId: "bl-7",
    arrival: "14:41",
    departure: "14:43",
    etaSeconds: 30,
    predictedBoarding: 96,
    predictedDeboarding: 210,
    status: "At Station",
    coaches: [
      { id: "c1", label: "Coach 1", capacity: 280, occupancy: 81 },
      { id: "cL", label: "Ladies Coach", capacity: 240, occupancy: 72 },
      { id: "c3", label: "Coach 3", capacity: 280, occupancy: 55 },
    ],
  },
  {
    id: "RL-UP-007",
    name: "RL-UP-007 · Motera Special",
    line: "red",
    direction: "Motera Stadium Bound",
    originId: "rl-1",
    destinationId: "rl-13",
    currentStationId: "rl-6",
    nextStationId: "rl-7",
    arrival: "14:45",
    departure: "14:47",
    etaSeconds: 340,
    predictedBoarding: 188,
    predictedDeboarding: 64,
    status: "Approaching",
    coaches: [
      { id: "c1", label: "Coach 1", capacity: 280, occupancy: 88 },
      { id: "cL", label: "Ladies Coach", capacity: 240, occupancy: 78 },
      { id: "c3", label: "Coach 3", capacity: 280, occupancy: 95 },
    ],
  },
  {
    id: "RL-DN-009",
    name: "RL-DN-009 · APMC Service",
    line: "red",
    direction: "APMC Bound",
    originId: "rl-13",
    destinationId: "rl-1",
    currentStationId: "rl-7",
    nextStationId: "rl-6",
    arrival: "14:40",
    departure: "14:42",
    etaSeconds: 0,
    predictedBoarding: 74,
    predictedDeboarding: 134,
    status: "Departing",
    coaches: [
      { id: "c1", label: "Coach 1", capacity: 280, occupancy: 22 },
      { id: "cL", label: "Ladies Coach", capacity: 240, occupancy: 41 },
      { id: "c3", label: "Coach 3", capacity: 280, occupancy: 35 },
    ],
  },
  {
    id: "BL-UP-002",
    name: "BL-UP-002 · Vastral Local",
    line: "blue",
    direction: "Vastral Gam Bound",
    originId: "bl-1",
    destinationId: "bl-14",
    currentStationId: "bl-5",
    nextStationId: "bl-6",
    arrival: "14:48",
    departure: "14:50",
    etaSeconds: 540,
    predictedBoarding: 110,
    predictedDeboarding: 70,
    status: "En Route",
    coaches: [
      { id: "c1", label: "Coach 1", capacity: 280, occupancy: 48 },
      { id: "cL", label: "Ladies Coach", capacity: 240, occupancy: 52 },
      { id: "c3", label: "Coach 3", capacity: 280, occupancy: 60 },
    ],
  },
  {
    id: "RL-UP-008",
    name: "RL-UP-008 · Sabarmati Local",
    line: "red",
    direction: "Sabarmati Bound",
    originId: "rl-1",
    destinationId: "rl-12",
    currentStationId: "rl-4",
    nextStationId: "rl-5",
    arrival: "14:52",
    departure: "14:54",
    etaSeconds: 720,
    predictedBoarding: 82,
    predictedDeboarding: 58,
    status: "En Route",
    coaches: [
      { id: "c1", label: "Coach 1", capacity: 280, occupancy: 30 },
      { id: "cL", label: "Ladies Coach", capacity: 240, occupancy: 48 },
      { id: "c3", label: "Coach 3", capacity: 280, occupancy: 42 },
    ],
  },
];

export function riskFor(trainOrAvg: Train | number): RiskLevel {
  let avg = 0;
  let boarding = 0;
  if (typeof trainOrAvg === "number") {
    avg = trainOrAvg;
  } else {
    avg = trainOrAvg.coaches.reduce((s, c) => s + c.occupancy, 0) / trainOrAvg.coaches.length;
    boarding = trainOrAvg.predictedBoarding;
  }
  if (avg >= 88 || boarding > 180) return "Critical";
  if (avg >= 75) return "High";
  if (avg >= 55) return "Moderate";
  return "Low";
}

export const RISK_TW: Record<RiskLevel, string> = {
  Low: "bg-success/15 text-success border-success/30",
  Moderate: "bg-warning/15 text-warning border-warning/30",
  High: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  Critical: "bg-danger/15 text-danger border-danger/30",
};

export interface Alert {
  id: string;
  severity:
    | "Emergency"
    | "Overcrowding"
    | "Platform Congestion"
    | "Coach Full"
    | "System Warning"
    | "Sensor Failure";
  title: string;
  description: string;
  time: string;
  resolved: boolean;
  acknowledged?: boolean;
  stationName?: string | null;
  trainId?: string | null;
}

export const ALERTS: Alert[] = [
  {
    id: "a1",
    severity: "Overcrowding",
    title: "Platform 2 nearing capacity",
    description: "Density at 87% — recommend slowing entry gates by 20%.",
    time: "14:39",
    resolved: false,
  },
  {
    id: "a2",
    severity: "Coach Full",
    title: "RL-UP-007 · Coach 3 at 95%",
    description: "Critical occupancy detected. Redirect passengers to Coach 1.",
    time: "14:38",
    resolved: false,
  },
  {
    id: "a3",
    severity: "Sensor Failure",
    title: "Gate 4 turnstile offline",
    description: "Backup lane B activated automatically.",
    time: "14:31",
    resolved: false,
  },
  {
    id: "a4",
    severity: "System Warning",
    title: "Maintenance window scheduled",
    description: "Server Node 4 maintenance at 02:00 IST.",
    time: "14:02",
    resolved: false,
  },
  {
    id: "a5",
    severity: "Emergency",
    title: "Medical assistance · Concourse",
    description: "Resolved at 14:18. Passenger handed to medics.",
    time: "14:10",
    resolved: true,
  },
];

export const ALERT_SEVERITY_TW: Record<Alert["severity"], string> = {
  Emergency: "bg-danger/15 text-danger border-danger/40",
  Overcrowding: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  "Platform Congestion": "bg-warning/15 text-warning border-warning/30",
  "Coach Full": "bg-danger/15 text-danger border-danger/30",
  "System Warning": "bg-accent-cyan/15 text-accent-cyan border-accent-cyan/30",
  "Sensor Failure": "bg-warning/15 text-warning border-warning/30",
};

export interface Recommendation {
  id: string;
  title: string;
  body: string;
  priority: "info" | "action" | "critical";
  action: string;
}

export const RECOMMENDATIONS: Recommendation[] = [
  {
    id: "r1",
    title: "Redirect passengers to Coach 1",
    body: "BL-UP-001 Coach 3 expected to reach 95% occupancy on arrival. Coach 1 at 38% has capacity for 175 passengers.",
    priority: "action",
    action: "Broadcast on Platform 2",
  },
  {
    id: "r2",
    title: "Deploy 2 standby staff to Entrance B",
    body: "Predicted surge of 450 passengers in 12 minutes from Motera Stadium event discharge.",
    priority: "critical",
    action: "Deploy Strategy",
  },
  {
    id: "r3",
    title: "Pre-cool Platform 2 to 19°C",
    body: "Thermal load forecast exceeds comfort band during expected surge window.",
    priority: "info",
    action: "Execute Cooling Plan",
  },
];

export interface Announcement {
  id: string;
  text: string;
  context: string;
}

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "an1",
    text: "Next train on Platform 2 toward Vastral Gam will arrive in 2 minutes. Please stand behind the yellow line.",
    context: "BL-UP-001 · 2 min ETA",
  },
  {
    id: "an2",
    text: "For a more comfortable journey, please move toward Coach 1 — Coach 3 is currently at full capacity.",
    context: "RL-UP-007 · Crowd flow",
  },
  {
    id: "an3",
    text: "Train RL-DN-009 departing Platform 1 toward APMC. Please complete boarding.",
    context: "RL-DN-009 · Departing",
  },
  {
    id: "an4",
    text: "Heavy crowd expected at Old High Court Interchange between 15:00 and 15:45 due to scheduled event. Allow extra travel time.",
    context: "Station-wide · Advisory",
  },
];

export interface Notification {
  id: string;
  type: "Delay" | "Crowd Alert" | "Recommendation" | "Announcement" | "Service Update";
  title: string;
  body: string;
  time: string;
}

export const NOTIFICATIONS: Notification[] = [
  {
    id: "n1",
    type: "Crowd Alert",
    title: "High occupancy on your route",
    body: "RL-UP-007 toward Motera Stadium is forecast at 92% on arrival.",
    time: "2 min ago",
  },
  {
    id: "n2",
    type: "Recommendation",
    title: "Smart Coach pick",
    body: "Board Coach 1 on BL-UP-001 — only 38% full.",
    time: "5 min ago",
  },
  {
    id: "n3",
    type: "Delay",
    title: "Minor delay · Blue Line",
    body: "BL-UP-002 running 90 seconds behind schedule.",
    time: "12 min ago",
  },
  {
    id: "n4",
    type: "Announcement",
    title: "Old High Court · Crowd advisory",
    body: "Heavy footfall expected 15:00–15:45.",
    time: "20 min ago",
  },
  {
    id: "n5",
    type: "Service Update",
    title: "Schedule updated",
    body: "Two additional services added on Red Line after 17:00.",
    time: "1 hr ago",
  },
];

export const CROWD_FORECAST = [
  { label: "Now", value: 1248, delta: 0 },
  { label: "+5 min", value: 1390, delta: 142 },
  { label: "+15 min", value: 1620, delta: 372 },
  { label: "+30 min", value: 1880, delta: 632 },
  { label: "+45 min", value: 2010, delta: 762 },
  { label: "+60 min", value: 1740, delta: 492 },
];

export const HOURLY_FLOW = Array.from({ length: 24 }, (_, h) => {
  const peak1 = Math.exp(-Math.pow(h - 9, 2) / 6) * 1800;
  const peak2 = Math.exp(-Math.pow(h - 18, 2) / 6) * 2200;
  const base = 240 + ((h * 37) % 80);
  return {
    hour: `${String(h).padStart(2, "0")}:00`,
    inflow: Math.round(base + peak1 + peak2),
    outflow: Math.round(base + peak1 * 0.9 + peak2 * 0.95),
  };
});

export const WEEKLY_TREND = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => ({
  day: d,
  passengers: 28000 + Math.round(Math.sin(i) * 4000) + (i >= 5 ? 6000 : 0),
}));


export const PLATFORM_HEATMAP = Array.from({ length: 4 }, (_, r) =>
  Array.from({ length: 12 }, (_, c) => {
    const peak = Math.exp(-Math.pow(c - 6, 2) / 8) * 90;
    const row = r === 1 || r === 2 ? 12 : 0;
    return Math.min(100, Math.round(peak + row + ((r * 13 + c * 7) % 18)));
  }),
);

export const KPI = {
  currentTrains: 8,
  passengersInStation: 1248,
  passengersInTransit: 3420,
  avgOccupancy: 64,
  activeAlerts: ALERTS.filter((a) => !a.resolved).length,
  predictedNextHour: 2010,
};

export function findStation(idOrName?: string | null): Station | undefined {
  if (!idOrName) return undefined;
  const raw = idOrName.trim();
  const lower = raw.toLowerCase();

  // 1. Direct ID match (case-insensitive)
  const byId = STATIONS.find((s) => s.id.toLowerCase() === lower);
  if (byId) return byId;

  // 2. Exact name match (case-insensitive)
  const byName = STATIONS.find((s) => s.name.toLowerCase() === lower);
  if (byName) return byName;

  // 2b. Clean name match (strip line suffixes e.g. "Old High Court (RL)" -> "Old High Court")
  const cleanName = lower.replace(/\s*\((rl|bl|red|blue)\)/g, "").replace(/\s*interchange/g, "").trim();
  const byCleanName = STATIONS.find((s) => s.name.toLowerCase() === cleanName);
  if (byCleanName) return byCleanName;

  // 3. Normalized ID match (e.g. "bl08", "bl-8", "bl-08", "bl8", "rl-7", "rl07")
  const match = lower.match(/^([a-z]{2})[-_]?0*(\d+)$/);
  if (match) {
    const prefix = match[1].toUpperCase();
    const num = parseInt(match[2], 10);
    const padded = `${prefix}${String(num).padStart(2, "0")}`;
    const byNormalized = STATIONS.find(
      (s) =>
        s.id.toUpperCase() === padded ||
        s.id.toUpperCase() === `${prefix}${num}` ||
        s.id.toLowerCase() === `${prefix.toLowerCase()}-${num}`,
    );
    if (byNormalized) return byNormalized;
  }

  // 4. Fuzzy / partial name match
  const byPartialName = STATIONS.find((s) => {
    const sLower = s.name.toLowerCase();
    return sLower.includes(lower) || lower.includes(sLower);
  });
  if (byPartialName) return byPartialName;

  return undefined;
}
