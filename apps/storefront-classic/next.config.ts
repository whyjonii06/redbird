import type { NextConfig } from 'next'

const config: NextConfig = {
  transpilePackages: ['@redbirdshop/core'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  typedRoutes: true,
}

export default config
