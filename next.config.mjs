/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@prisma/client'],
  transpilePackages: [
    'antd',
    'rc-util',
    '@ant-design/icons',
    '@ant-design/cssinjs-utils',
    '@ant-design/nextjs-registry',
    'rc-pagination',
    'rc-picker',
    'rc-notification',
    'rc-tooltip',
    'rc-tree',
    'rc-table',
  ],
}

export default nextConfig
