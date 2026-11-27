import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createAuthClient } from '@neon/auth'
import { BetterAuthReactAdapter } from '@neon/auth/react/adapters'
import { createRealtimeClient } from '@neon/realtime/client'
import { RealtimeProvider, useLiveQuery } from '@neon/realtime-react'

const Config = createContext({})
const Auth = createContext({ loading: true })
export const useConfig = () => useContext(Config)
export const useAuth = () => useContext(Auth)

export async function api(path, { body, method = body === undefined ? 'GET' : 'POST', signal } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const response = await fetch(`/api${path}`, {
    method, headers, signal, credentials: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (response.status === 204) return
  const data = await response.json().catch(() => null)
  if (!response.ok || data === null) {
    const error = new Error(data?.error || 'No pudimos conectar. Intenta de nuevo.')
    error.status = response.status
    error.field = data?.field
    throw error
  }
  return data
}

const publicResponses = new Map()

export function usePublicResource(path, { keepPrevious = false } = {}) {
  return useResource(path, api, { cache: publicResponses, keepPrevious })
}

export function useResource(path, read = api, { cache, keepPrevious = false } = {}) {
  const [state, setState] = useState(null)
  const [revision, setRevision] = useState(0)
  const previous = useRef()
  const refresh = useCallback(() => setRevision((value) => value + 1), [])
  useEffect(() => {
    if (!path) return
    const controller = new AbortController()
    read(path, { signal: controller.signal }).then(
      (data) => {
        if (controller.signal.aborted) return
        const result = { path, data }
        if (cache) {
          cache.delete(path)
          cache.set(path, result)
          if (cache.size > 40) cache.delete(cache.keys().next().value)
        }
        setState(result)
      },
      (error) => {
        if (controller.signal.aborted) return
        const cached = cache?.get(path)
        const invalidate = cache && error.status >= 400 && error.status < 500
        if (invalidate) cache.delete(path)
        setState((old) => {
          const last = old?.path === path ? old : cached
          return { path, data: invalidate ? undefined : last?.data, error }
        })
      },
    )
    return () => controller.abort()
  }, [path, read, revision, cache])
  const current = state?.path === path ? state : cache?.get(path)
  useLayoutEffect(() => {
    if (keepPrevious && (!path || current)) previous.current = current?.data
  }, [current, keepPrevious, path])
  const pending = Boolean(path && !current)
  const retained = pending && keepPrevious ? previous.current : undefined
  return { ...current, data: current?.data ?? retained, loading: pending && retained === undefined, updating: pending && retained !== undefined, refresh }
}

function ManagedAuth({ authUrl, onSession }) {
  const client = useMemo(() => createAuthClient(new URL(authUrl, window.location.origin).href, {
    adapter: BetterAuthReactAdapter({ fetchOptions: { credentials: 'include' } }),
  }), [authUrl])
  const { data, isPending } = client.useSession()
  const user = data?.user
  const { data: account, loading: accountLoading, error: accountError, refresh: refreshAccount } = useResource(user ? '/account' : null)
  useLayoutEffect(() => {
    onSession({ authUrl, value: { client, user, loading: isPending, request: api, account, accountLoading, accountError, refreshAccount } })
  }, [authUrl, client, user, isPending, account, accountLoading, accountError, refreshAccount, onSession])
  return null
}

export function Services({ children }) {
  const [session, setSession] = useState(null)
  const config = useResource('/config')
  const authUrl = config.data?.authUrl
  const realtime = useMemo(() => config.data?.realtimeUrl
    ? createRealtimeClient({ url: config.data.realtimeUrl }) : null, [config.data?.realtimeUrl])
  const auth = authUrl && session?.authUrl === authUrl ? session.value : { loading: config.loading || Boolean(authUrl) }
  return <Config.Provider value={{ ...config.data, loading: config.loading, realtime: Boolean(realtime) }}>
    <Auth.Provider value={auth}>
      {authUrl && <ManagedAuth authUrl={authUrl} onSession={setSession} />}
      <RealtimeProvider client={realtime}>{children}</RealtimeProvider>
    </Auth.Provider>
  </Config.Provider>
}

function LiveRows({ sealed, read, onRefresh, onStatus }) {
  const { data, status } = useLiveQuery(sealed, { refreshQuery: read })
  const snapshot = data?.map(({ id, version }) => `${id}:${version}`).sort().join(',')
  useEffect(() => {
    if (snapshot !== undefined && status === 'ready') onRefresh()
  }, [snapshot, status, onRefresh])
  useEffect(() => {
    onStatus(status === 'ready')
    return () => onStatus(false)
  }, [status, onStatus])
  return null
}

export function LiveRefresh({ channel, onRefresh, privileged = false }) {
  const { realtime } = useConfig()
  const { request } = useAuth()
  const [ready, setReady] = useState(false)
  const path = realtime && channel && (!privileged || request) ? `/live/${channel}` : null
  const transport = privileged ? request : api
  const resource = useResource(path, transport)
  const renew = useCallback(() => transport(path), [transport, path])
  const { refresh } = resource
  useEffect(() => {
    if (!channel) return
    function update() {
      if (document.visibilityState !== 'visible') return
      onRefresh()
      if (path && !ready) refresh()
    }
    document.addEventListener('visibilitychange', update)
    const timer = !ready ? window.setInterval(update, 30_000) : null
    return () => {
      document.removeEventListener('visibilitychange', update)
      window.clearInterval(timer)
    }
  }, [channel, onRefresh, path, ready, refresh])
  return path && resource.data ? <LiveRows key={path} sealed={resource.data} read={renew} onRefresh={onRefresh} onStatus={setReady} /> : null
}
