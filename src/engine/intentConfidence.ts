export function classifyIntentConfidence(confidence: number): 'act' | 'confirm-meaning' | 'buttons' {
  if (confidence >= 0.82) return 'act';
  if (confidence >= 0.55) return 'confirm-meaning';
  return 'buttons';
}
