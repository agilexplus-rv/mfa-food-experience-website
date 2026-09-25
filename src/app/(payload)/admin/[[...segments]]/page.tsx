import { use } from 'react'
import type { Metadata } from 'next'

import CreateFirstUserView from '@/components/admin/CreateFirstUserView'
import config from '@payload-config'
import { RootPage, generatePageMetadata } from '@payloadcms/next/views'
import { importMap } from '../importMap.js'

type Args = {
  params: Promise<{
    segments: string[]
  }>
  searchParams: Promise<{
    [key: string]: string | string[]
  }>
}

export const generateMetadata = async ({ params, searchParams }: Args): Promise<Metadata> =>
  generatePageMetadata({ config, params, searchParams })

const Page = ({ params, searchParams }: Args) => {
  const { segments } = use(params)
  // Bypass Payload's internal view override (which does not activate
  // reliably for the createFirstUser key) and render our branded
  // two-step setup component directly.
  if (segments.length === 1 && segments[0] === 'create-first-user') {
    return <CreateFirstUserView />
  }
  return RootPage({ config, importMap, params, searchParams })
}

export default Page
