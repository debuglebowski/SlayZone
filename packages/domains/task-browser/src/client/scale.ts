/** Compute scale factor to fit a device viewport within a container, reserving space for resize handles. */
export function computeScale(
  container: { width: number; height: number } | null,
  device: { width: number; height: number } | null,
  handlePad = 40
): number {
  if (!container || !device || device.width <= 0 || device.height <= 0) return 1
  const availW = container.width - handlePad
  const availH = container.height - handlePad
  if (availW <= 0 || availH <= 0) return 1
  return Math.min(1, availW / device.width, availH / device.height)
}
