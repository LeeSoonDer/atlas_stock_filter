export interface FredObservation {
  date: string;
  /** null for FRED's own "." missing-value marker (holidays/no print), never fabricated. */
  value: number | null;
}
