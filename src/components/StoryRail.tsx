'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { useSession } from '@/components/session-provider'
import { fetchPostsByExperts } from '@/lib/wizard/api'
import type { ExpertSummary, PostListItem } from '@/lib/wizard/types'

/**
 * Anasayfa hikâye rayı.
 *
 * Takip edilen uzmanların son 14 gündeki yazıları; uzman başına tek yuvarlak avatar
 * (en yeni yazı). Halka "okunmadı" demek: okundu bilgisi cihazda (localStorage) tutulur,
 * sunucuya yazılmaz. Takip yoksa ya da son 14 günde yazı yoksa hiç render edilmez.
 */

const SEEN_KEY = 'ud.story-seen'
const WINDOW_DAYS = 14

type SeenMap = Record<string, string>

function readSeen(): SeenMap {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as SeenMap
  } catch {
    return {}
  }
}

function writeSeen(map: SeenMap) {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(map))
  } catch {
    // Depolama kapalıysa okundu bilgisi kaybolur; ray çalışmaya devam eder.
  }
}

type Story = { expert: ExpertSummary; post: PostListItem; unread: boolean }

export function StoryRail() {
  const { user, restoring, followingIds } = useSession()
  const [posts, setPosts] = useState<PostListItem[]>([])
  const [seen, setSeen] = useState<SeenMap>({})
  const [loading, setLoading] = useState(false)

  const followingKey = followingIds.join(',')

  useEffect(() => {
    setSeen(readSeen())
  }, [])

  useEffect(() => {
    if (restoring || !user || followingIds.length === 0) {
      setPosts([])
      return
    }
    let cancelled = false
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000)
    setLoading(true)
    fetchPostsByExperts(followingIds, { limit: 40, since })
      .then((docs) => {
        if (!cancelled) setPosts(docs)
      })
      .catch(() => {
        if (!cancelled) setPosts([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [restoring, user, followingKey])

  const stories = useMemo<Story[]>(() => {
    const newestByExpert = new Map<string, { expert: ExpertSummary; post: PostListItem }>()
    for (const post of posts) {
      if (!post.expert || typeof post.expert !== 'object') continue
      if (!newestByExpert.has(post.expert.id)) {
        newestByExpert.set(post.expert.id, { expert: post.expert, post })
      }
    }
    return Array.from(newestByExpert.values())
      .map((entry) => ({
        ...entry,
        unread: new Date(entry.post.publishedAt ?? 0).getTime() > new Date(seen[entry.expert.id] ?? 0).getTime(),
      }))
      .sort(
        (a, b) =>
          new Date(b.post.publishedAt ?? 0).getTime() - new Date(a.post.publishedAt ?? 0).getTime(),
      )
  }, [posts, seen])

  if (restoring || loading || !user || stories.length === 0) return null

  function markSeen(story: Story) {
    const next = { ...seen, [story.expert.id]: story.post.publishedAt ?? new Date().toISOString() }
    setSeen(next)
    writeSeen(next)
  }

  return (
    <section aria-labelledby="stories-heading" className="border-b border-border py-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="stories-heading" className="font-mono text-[0.65rem] tracking-[0.2em] text-stamp uppercase">
          TAKİP ETTİKLERİN
        </h2>
        <Link
          href="/uzmanlar"
          className="font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase hover:text-foreground"
        >
          Uzmanlar
        </Link>
      </div>
      <ul className="-mx-1 mt-4 flex gap-4 overflow-x-auto px-1 pb-2">
        {stories.map((story) => (
          <li key={story.expert.id} className="w-[4.5rem] shrink-0">
            <Link
              href={`/yazilar/${story.post.slug}`}
              onClick={() => markSeen(story)}
              className="group flex flex-col items-center gap-1.5 rounded-lg p-1 outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
              aria-label={`${story.expert.name}: ${story.post.title}${story.unread ? ' (yeni)' : ''}`}
            >
              <span
                className={
                  story.unread
                    ? 'rounded-full bg-gradient-to-tr from-stamp to-tape-yellow p-[2.5px]'
                    : 'rounded-full bg-border p-[2.5px]'
                }
              >
                <span className="block rounded-full bg-background p-[2px]">
                  {typeof story.expert.avatar === 'object' && story.expert.avatar?.url ? (
                    <img
                      src={story.expert.avatar.url}
                      alt={story.expert.avatar.alt || story.expert.name}
                      className="size-16 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex size-16 items-center justify-center rounded-full bg-muted font-display text-xl text-muted-foreground"
                    >
                      {story.expert.name.slice(0, 1)}
                    </span>
                  )}
                </span>
              </span>
              <span className="w-full truncate text-center text-[0.7rem] text-muted-foreground group-hover:text-foreground">
                {story.expert.name}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
