import type { Database } from 'better-sqlite3'
import type { IncomingMessage } from 'node:http'

export interface AutomationEngineLike {
  executeManual(id: string): Promise<unknown>
}

export type TrpcServerDeps = {
  db: Database
  dataRoot: string
  /** Optional — only present in Electron-main host. Standalone server pkg
   *  may run without an engine for now. */
  automationEngine?: AutomationEngineLike
}

export type TrpcContext = TrpcServerDeps & {
  req?: IncomingMessage
}

export type TrpcContextFactory = (req?: IncomingMessage) => TrpcContext
