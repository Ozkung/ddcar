'use client'
import { useEffect, useRef } from 'react'

export type SSEEvent =
  | { type: 'job_created'; jobId: string; jobNo: string; shopId: string }
  | { type: 'job_status_changed'; jobId: string; jobNo: string; status: string; shopId: string }

export function useSSE(onEvent: (event: SSEEvent) => void) {
  const handlerRef = useRef(onEvent)
  handlerRef.current = onEvent

  useEffect(() => {
    const es = new EventSource('/api/events')

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as SSEEvent
        handlerRef.current(data)
      } catch {
        // ignore ping or malformed
      }
    }

    return () => es.close()
  }, [])
}
