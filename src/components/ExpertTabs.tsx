'use client'

import type { ReactNode } from 'react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export type ExpertTab = {
  value: string
  label: string
  /** Başlığın yanındaki sayaç/etiket (ör. "12 yazı"). */
  meta?: string
  content: ReactNode
}

/**
 * Uzman dosyasının alt bölümlerini tek sekme şeridinde toplar.
 * İçerik sunucuda render edilir; bu bileşen yalnız seçimi yönetir.
 */
export function ExpertTabs({ tabs, defaultValue }: { tabs: ExpertTab[]; defaultValue?: string }) {
  const initial = tabs.find((tab) => tab.value === defaultValue)?.value ?? tabs[0]?.value
  if (!initial) return null

  return (
    <Tabs defaultValue={initial} className="mt-10 flex-col gap-4">
      <TabsList
        variant="line"
        aria-label="Uzman bölümleri"
        className="h-auto w-full justify-start gap-4 overflow-x-auto rounded-none border-b-2 border-foreground/80 p-0 pb-2 sm:gap-6"
      >
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="h-auto flex-none items-baseline gap-2 rounded-none p-0 pb-0 font-display text-base whitespace-nowrap text-muted-foreground transition-colors after:inset-x-0 after:bottom-[-8px] after:h-0.5 data-[state=active]:text-foreground data-[state=active]:after:opacity-100 hover:text-foreground dark:data-[state=active]:text-foreground sm:text-xl"
          >
            {tab.label}
            {tab.meta ? (
              <span className="font-mono text-[0.65rem] font-normal tracking-[0.14em] text-faded uppercase">
                {tab.meta}
              </span>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}
