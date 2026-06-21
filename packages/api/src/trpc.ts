// The tRPC foundation now lives in the shared @redbirdshop/trpc package so
// that module routers can build against the same typed context without a
// circular dependency on the API. Re-exported here so existing imports
// (`from '../trpc.js'`) across the API routers keep working unchanged.
export * from '@redbirdshop/trpc'
