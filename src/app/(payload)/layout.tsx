import type { ServerFunctionClient } from 'payload'
import type React from 'react'

import '@payloadcms/ui/styles.css'
import config from '@payload-config'
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts'
import { importMap } from './admin/importMap.js'

const serverFunction: ServerFunctionClient = async function (args) {
  'use server'
  return handleServerFunctions({
    ...args,
    config,
    importMap,
  })
}

type LayoutArgs = {
  children: React.ReactNode
}

const Layout = ({ children }: LayoutArgs) =>
  RootLayout({
    config,
    importMap,
    serverFunction,
    children,
  })

export default Layout
