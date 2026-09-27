import { Hero } from "@/components/home/Hero"
import { HomeContent } from "@/components/home/HomeContent"
import { ComingEvents } from "@/components/home/ComingEvents"
import { LatestNews } from "@/components/home/LatestNews"

export default function Home() {
  return (
    <>
      <Hero />
      <HomeContent />
      <ComingEvents />
      <LatestNews />
    </>
  )
}
