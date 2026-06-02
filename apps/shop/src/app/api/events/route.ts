import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import Redis from 'ioredis'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { shopId } = session.user
  const channel = `shop:${shopId}`
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const subscriber = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')

      subscriber.subscribe(channel).catch(() => {
        controller.close()
        subscriber.quit()
      })

      subscriber.on('message', (_ch: string, message: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${message}\n\n`))
        } catch {
          // controller already closed
        }
      })

      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`event: ping\ndata: {}\n\n`))
        } catch {
          clearInterval(ping)
        }
      }, 30_000)

      req.signal.addEventListener('abort', () => {
        clearInterval(ping)
        subscriber.unsubscribe(channel).finally(() => subscriber.quit())
        try { controller.close() } catch { /* already closed */ }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
