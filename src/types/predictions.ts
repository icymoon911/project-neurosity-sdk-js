export interface Prediction {
  metric: "predictions";
  label: string;
  probability: number;
  timestamp: number;
}
