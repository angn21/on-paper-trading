export function vibrate(pattern = 10) {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Unsupported on some devices.
  }
}
