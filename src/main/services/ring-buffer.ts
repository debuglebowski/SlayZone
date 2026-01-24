/**
 * Ring buffer for terminal output with fixed maximum size.
 * Drops oldest content when capacity is exceeded.
 */
export class RingBuffer {
  private chunks: string[] = []
  private totalSize = 0
  private readonly maxSize: number

  constructor(maxSize: number) {
    this.maxSize = maxSize
  }

  /**
   * Append data to the buffer. Drops oldest chunks if over capacity.
   */
  append(data: string): void {
    this.chunks.push(data)
    this.totalSize += data.length

    // Drop oldest chunks until under max size
    while (this.totalSize > this.maxSize && this.chunks.length > 1) {
      const dropped = this.chunks.shift()!
      this.totalSize -= dropped.length
    }

    // If single chunk still exceeds max, truncate it
    if (this.totalSize > this.maxSize && this.chunks.length === 1) {
      this.chunks[0] = this.chunks[0].slice(-this.maxSize)
      this.totalSize = this.chunks[0].length
    }
  }

  /**
   * Get the full buffer contents as a string.
   */
  toString(): string {
    return this.chunks.join('')
  }

  /**
   * Clear the buffer.
   */
  clear(): void {
    this.chunks = []
    this.totalSize = 0
  }

  /**
   * Get current size in bytes.
   */
  get size(): number {
    return this.totalSize
  }
}
