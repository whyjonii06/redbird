import { useEffect, useRef } from 'react'

export function useEventSource(url: string, onMessage: (data: unknown) => void) {
  const cb = useRef(onMessage)
  cb.current = onMessage
  useEffect(() => {
    const es = new EventSource(url)
    es.onmessage = (e) => {
      try {
        cb.current(JSON.parse(e.data as string))
      } catch {}
    }
    es.onerror = () => {} // reconnects automatically
    return () => es.close()
  }, [url])
}
