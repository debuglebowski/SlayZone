import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ScopeTracker } from './scope-tracker'

describe('ScopeTracker', () => {
  let tracker: ScopeTracker

  beforeEach(() => {
    tracker = new ScopeTracker()
  })

  afterEach(() => {
    tracker.destroy()
  })

  describe('getActiveScopes', () => {
    it('always includes global', () => {
      expect(tracker.getActiveScopes().has('global')).toBe(true)
    })

    it('includes task when taskActive', () => {
      tracker.taskActive = true
      const scopes = tracker.getActiveScopes()
      expect(scopes.has('global')).toBe(true)
      expect(scopes.has('task')).toBe(true)
    })

    it('does not include task when not active', () => {
      tracker.taskActive = false
      expect(tracker.getActiveScopes().has('task')).toBe(false)
    })
  })

  describe('browserPassthrough', () => {
    it('returns false when no browser panel focused', () => {
      expect(tracker.isBrowserPassthrough()).toBe(false)
    })

    it('returns false when focused panel has passthrough disabled', () => {
      tracker.setBrowserPassthrough('panel-1', false)
      expect(tracker.isBrowserPassthrough()).toBe(false)
    })
  })

  describe('focus detection', () => {
    it('starts with no component scope', () => {
      expect(tracker.currentComponentScope).toBeNull()
    })
  })
})
