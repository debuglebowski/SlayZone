import { useContext } from 'react'
import { TelemetryContext } from './TelemetryProvider'

export function useTelemetry() {
  return useContext(TelemetryContext)
}
