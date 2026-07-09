'use client'

import Card from '@/components/console/Card'

export default function ContentPage() {
  return (
    <div>
      <h1 className="mb-8 text-2xl font-black text-lunar-green tracking-tight">Content</h1>
      <Card className="text-center py-12">
        <p className="text-lg font-semibold text-lunar-green mb-2">Content Management</p>
        <p className="text-sm text-text-light mb-4">
          Testimonials, News Items, and Policies management will be available in Phase B.
        </p>
        <span className="inline-block rounded-full bg-matte-gold/20 px-3 py-1 text-xs font-semibold text-matte-gold">
          Coming in Phase B
        </span>
      </Card>
    </div>
  )
}
