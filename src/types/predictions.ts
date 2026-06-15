/**
 * Prediction result emitted by the predictions metric stream.
 */
export interface Prediction {
  metric: "predictions";
  label: string;
  probability: number;
  timestamp: number;
}
