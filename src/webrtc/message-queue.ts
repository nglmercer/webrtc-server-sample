/**
 * Message Queue Management
 * 
 * Handles message queuing, retry logic, and delivery guarantees
 * for WebRTC peer connections.
 */

export interface QueuedMessage {
  data: string | ArrayBuffer | ArrayBufferView;
  timestamp: number;
  channelLabel: string;
  retryCount: number;
  maxRetries: number;
  priority: 'low' | 'normal' | 'high';
}

export interface MessageQueueConfig {
  maxSize: number;
  maxRetries: number;
  retryDelay: number;
  enablePriority: boolean;
}

/**
 * Message Queue Manager
 */
export class MessageQueue {
  private queue: QueuedMessage[] = [];
  private config: MessageQueueConfig;
  private processing = false;

  constructor(config: Partial<MessageQueueConfig> = {}) {
    this.config = {
      maxSize: 1000,
      maxRetries: 5,
      retryDelay: 1000,
      enablePriority: false,
      ...config
    };
  }

  /**
   * Add message to queue
   */
  enqueue(
    data: string | ArrayBuffer | ArrayBufferView,
    channelLabel: string,
    priority: QueuedMessage['priority'] = 'normal'
  ): void {
    const message: QueuedMessage = {
      data,
      timestamp: Date.now(),
      channelLabel,
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      priority
    };

    if (this.queue.length >= this.config.maxSize) {
      // Remove oldest message if queue is full
      this.dequeue();
    }

    if (this.config.enablePriority) {
      // Insert based on priority
      const insertIndex = this.findInsertIndex(message);
      this.queue.splice(insertIndex, 0, message);
    } else {
      // Simple FIFO
      this.queue.push(message);
    }
  }

  /**
   * Remove and return first message from queue
   */
  dequeue(): QueuedMessage | null {
    return this.queue.shift() || null;
  }

  /**
   * Get messages for specific channel
   */
  getMessagesForChannel(channelLabel: string): QueuedMessage[] {
    return this.queue.filter(msg => msg.channelLabel === channelLabel);
  }

  /**
   * Remove messages for specific channel
   */
  removeMessagesForChannel(channelLabel: string): QueuedMessage[] {
    const removed = this.queue.filter(msg => msg.channelLabel === channelLabel);
    this.queue = this.queue.filter(msg => msg.channelLabel !== channelLabel);
    return removed;
  }

  /**
   * Mark message as failed and optionally requeue
   */
  markFailed(message: QueuedMessage, requeue: boolean = false): void {
    message.retryCount++;
    
    if (requeue && message.retryCount < message.maxRetries) {
      // Add delay before retry
      setTimeout(() => {
        this.queue.push(message);
      }, this.config.retryDelay);
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    total: number;
    byChannel: Record<string, number>;
    byPriority: Record<string, number>;
    oldestTimestamp: number | null;
    averageRetries: number;
  } {
    const byChannel: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    let totalRetries = 0;
    let oldestTimestamp: number | null = null;

    this.queue.forEach(message => {
      byChannel[message.channelLabel] = (byChannel[message.channelLabel] || 0) + 1;
      byPriority[message.priority] = (byPriority[message.priority] || 0) + 1;
      totalRetries += message.retryCount;
      
      if (!oldestTimestamp || message.timestamp < oldestTimestamp) {
        oldestTimestamp = message.timestamp;
      }
    });

    return {
      total: this.queue.length,
      byChannel,
      byPriority,
      oldestTimestamp,
      averageRetries: this.queue.length > 0 ? totalRetries / this.queue.length : 0
    };
  }

  /**
   * Clear all messages
   */
  clear(): void {
    this.queue = [];
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Find appropriate insert index based on priority
   */
  private findInsertIndex(message: QueuedMessage): number {
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    
    for (let i = 0; i < this.queue.length; i++) {
      if (priorityOrder[message.priority] < priorityOrder[this.queue[i].priority]) {
        return i;
      }
    }
    
    return this.queue.length;
  }

  /**
   * Process queue with provided send function
   */
  async process(sendFunction: (message: QueuedMessage) => Promise<boolean>): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;
    const messagesToKeep: QueuedMessage[] = [];

    for (const message of this.queue) {
      try {
        const sent = await sendFunction(message);
        
        if (sent) {
          // Message sent successfully, don't requeue
          continue;
        } else {
          // Message failed to send
          if (message.retryCount < message.maxRetries) {
            message.retryCount++;
            messagesToKeep.push(message);
          }
          // If max retries exceeded, message is dropped
        }
      } catch (error) {
        // Handle send error
        if (message.retryCount < message.maxRetries) {
          message.retryCount++;
          messagesToKeep.push(message);
        }
      }
    }

    this.queue = messagesToKeep;
    this.processing = false;
  }
}
