export type EventType = "earnings" | "lockup_expiry" | "shareholder_meeting" | "product_launch";

export interface EventWindowEntry {
  type: EventType;
  date: string;
  daysUntil: number;
}

export interface EventWindowConfig {
  eventWindow: {
    windowDays: number;
  };
}
