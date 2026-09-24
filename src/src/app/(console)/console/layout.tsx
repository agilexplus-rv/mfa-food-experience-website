import ConsoleShell from './ConsoleShell'

export default function ConsoleRootLayout({ children }: { children: React.ReactNode }) {
  return <ConsoleShell>{children}</ConsoleShell>
}
