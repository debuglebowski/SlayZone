import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { getDataRoot, getMcpPort, getServerHost } from './paths'
import { getStateDir } from './dirs'

const ENV_KEYS = ['SLAYZONE_STORE_DIR', 'SLAYZONE_MCP_PORT', 'SLAYZONE_HOST'] as const

describe('getDataRoot', () => {
  let saved: Record<string, string | undefined>

  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))
  })

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  })

  test('honors SLAYZONE_STORE_DIR when set', () => {
    process.env.SLAYZONE_STORE_DIR = '/tmp/slay-test'
    expect(getDataRoot()).toBe('/tmp/slay-test')
  })

  test('falls back to getStateDir when SLAYZONE_STORE_DIR unset', () => {
    delete process.env.SLAYZONE_STORE_DIR
    expect(getDataRoot()).toBe(getStateDir())
  })

  test('falls back to getStateDir when SLAYZONE_STORE_DIR empty string', () => {
    process.env.SLAYZONE_STORE_DIR = ''
    expect(getDataRoot()).toBe(getStateDir())
  })
})

describe('getMcpPort', () => {
  let saved: string | undefined

  beforeEach(() => {
    saved = process.env.SLAYZONE_MCP_PORT
  })

  afterEach(() => {
    if (saved === undefined) delete process.env.SLAYZONE_MCP_PORT
    else process.env.SLAYZONE_MCP_PORT = saved
  })

  test('returns parsed port when SLAYZONE_MCP_PORT set', () => {
    process.env.SLAYZONE_MCP_PORT = '4848'
    expect(getMcpPort()).toBe(4848)
  })

  test('returns undefined when unset', () => {
    delete process.env.SLAYZONE_MCP_PORT
    expect(getMcpPort()).toBeUndefined()
  })

  test('returns undefined when empty', () => {
    process.env.SLAYZONE_MCP_PORT = ''
    expect(getMcpPort()).toBeUndefined()
  })

  test('returns undefined when not a number', () => {
    process.env.SLAYZONE_MCP_PORT = 'abc'
    expect(getMcpPort()).toBeUndefined()
  })

  test('returns undefined when out of range', () => {
    process.env.SLAYZONE_MCP_PORT = '70000'
    expect(getMcpPort()).toBeUndefined()
  })
})

describe('getServerHost', () => {
  let savedHost: string | undefined
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    savedHost = process.env.SLAYZONE_HOST
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    if (savedHost === undefined) delete process.env.SLAYZONE_HOST
    else process.env.SLAYZONE_HOST = savedHost
    warnSpy.mockRestore()
  })

  test('defaults to 127.0.0.1 when unset', () => {
    delete process.env.SLAYZONE_HOST
    expect(getServerHost()).toBe('127.0.0.1')
    expect(warnSpy).not.toHaveBeenCalled()
  })

  test('honors SLAYZONE_HOST=127.0.0.1 without warn', () => {
    process.env.SLAYZONE_HOST = '127.0.0.1'
    expect(getServerHost()).toBe('127.0.0.1')
    expect(warnSpy).not.toHaveBeenCalled()
  })

  test('honors SLAYZONE_HOST=localhost without warn', () => {
    process.env.SLAYZONE_HOST = 'localhost'
    expect(getServerHost()).toBe('localhost')
    expect(warnSpy).not.toHaveBeenCalled()
  })

  test('honors SLAYZONE_HOST=::1 without warn', () => {
    process.env.SLAYZONE_HOST = '::1'
    expect(getServerHost()).toBe('::1')
    expect(warnSpy).not.toHaveBeenCalled()
  })

  test('warns when SLAYZONE_HOST is non-loopback', () => {
    process.env.SLAYZONE_HOST = '0.0.0.0'
    expect(getServerHost()).toBe('0.0.0.0')
    expect(warnSpy).toHaveBeenCalledOnce()
  })
})
