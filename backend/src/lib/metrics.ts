/**
 * Metrics Collection for Gemini API Usage
 * Tracks file transfer volume and search API call counts
 */

export interface GeminiMetrics {
  user_id: string
  note_id?: string
  event_type: 'file_upload' | 'search_query' | 'file_store_created'
  file_count?: number
  bytes_transferred?: number
  timestamp: string
}

/**
 * Log Gemini API metrics to console and analytics
 * In production, this would send to Cloudflare Analytics Engine
 */
export function logGeminiMetrics(metrics: GeminiMetrics): void {
  // Log to console for now
  console.log('[GEMINI_METRICS]', JSON.stringify(metrics))

  // TODO: In production, send to Cloudflare Analytics Engine:
  // env.ANALYTICS.writeDataPoint({
  //   blobs: [metrics.user_id, metrics.event_type],
  //   doubles: [metrics.bytes_transferred || 0, metrics.file_count || 0],
  //   indexes: [metrics.note_id || ''],
  // })
}

/**
 * Log file upload to File Store
 */
export function logFileUpload(
  userId: string,
  noteId: string,
  fileCount: number,
  bytesTransferred: number
): void {
  logGeminiMetrics({
    user_id: userId,
    note_id: noteId,
    event_type: 'file_upload',
    file_count: fileCount,
    bytes_transferred: bytesTransferred,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Log File Store creation
 */
export function logFileStoreCreated(userId: string, noteId: string): void {
  logGeminiMetrics({
    user_id: userId,
    note_id: noteId,
    event_type: 'file_store_created',
    timestamp: new Date().toISOString(),
  })
}

/**
 * Log search query execution
 */
export function logSearchQuery(
  userId: string,
  noteId: string,
  queryLength: number
): void {
  logGeminiMetrics({
    user_id: userId,
    note_id: noteId,
    event_type: 'search_query',
    bytes_transferred: queryLength,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Check if metrics exceed threshold and return warning
 */
export interface MetricsThreshold {
  exceeded: boolean
  message?: string
  current_value: number
  threshold_value: number
}

/**
 * Example threshold checker (can be expanded based on requirements)
 * This would typically query accumulated metrics from Analytics Engine
 */
export async function checkMetricsThreshold(
  userId: string,
  metricType: 'file_uploads' | 'search_queries',
  currentValue: number
): Promise<MetricsThreshold> {
  // Define thresholds (these should be configurable)
  const thresholds = {
    file_uploads: 1000, // Max 1000 file uploads per user per month
    search_queries: 10000, // Max 10000 search queries per user per month
  }

  const threshold = thresholds[metricType]
  const exceeded = currentValue >= threshold

  if (exceeded) {
    return {
      exceeded: true,
      message: `You have exceeded the ${metricType} threshold of ${threshold}. Current usage: ${currentValue}.`,
      current_value: currentValue,
      threshold_value: threshold,
    }
  }

  return {
    exceeded: false,
    current_value: currentValue,
    threshold_value: threshold,
  }
}
