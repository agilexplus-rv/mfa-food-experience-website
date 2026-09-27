import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { MtText } from '@/components/i18n/MtText'

export const metadata: Metadata = {
  title: 'About | Malta Food Experience',
  description:
    'Learn about the Malta Food Experience, brought to you by the Malta Food Agency: hands-on cooking classes, tastings, and authentic Maltese culinary experiences for residents and visitors.',
}

const STEPS = [
  {
    title: 'Discover',
    text: "Meet your chef and discover the dishes you will be preparing. Learn about their origins, the ingredients used and their place within Malta's culinary traditions.",
  },
  {
    title: 'Learn',
    text: 'Follow demonstrations and learn practical cooking techniques, professional tips and the importance of choosing fresh, seasonal ingredients.',
  },
  {
    title: 'Cook',
    text: 'It is your turn to get cooking. Prepare the dishes at your own workstation, with your chef available throughout the class to guide you and answer your questions.',
  },
  {
    title: 'Enjoy',
    text: 'Once the cooking is complete, sit down and enjoy the dishes you have prepared in a friendly communal setting, accompanied by a complimentary glass of wine or beer. Alternatively, you may take your creations home to enjoy later.',
  },
  {
    title: 'Take the Experience Home',
    text: 'Leave with the recipes, skills and knowledge you need to recreate the dishes yourself and continue exploring Maltese cuisine in your own kitchen.',
  },
]

const WHO_CAN_JOIN = [
  'Couples',
  'Friends',
  'Family members',
  'Parents and children',
  'Anyone interested in discovering Maltese food and cooking',
]

const DISCOVER_POINTS = [
  'Taste local ingredients.',
  'Learn traditional recipes.',
  'Discover new skills.',
  'Meet the stories behind the food.',
]

const h2 = 'text-2xl font-bold tracking-tight text-lunar-green sm:text-3xl'
const body = 'mt-3 text-base leading-relaxed text-text-light sm:text-lg'
const lead = 'mt-3 text-lg font-semibold text-lunar-green sm:text-xl'

function Bullet({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teracotta" />
      <span>{children}</span>
    </li>
  )
}

function ExploreCta() {
  return (
    <Link
      href="/services"
      className="mt-8 inline-flex items-center gap-2 rounded-lg bg-terracotta px-8 py-4 text-xl font-bold text-white transition-colors hover:bg-terracotta/85 focus:outline-2 focus:outline-offset-2 focus:outline-terracotta"
    >
      <MtText en="Explore Our Experiences" mt="Esplora l-Esperjenzi Tagħna" />
      <span aria-hidden="true">&rarr;</span>
    </Link>
  )
}

/** Shared fade-up class applied to each section. */
const fade = 'opacity-0 animate-fade-up' as const

const delay = (ms: number) => ({ animationDelay: `${ms}ms` } as React.CSSProperties)

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-4xl px-6 py-16">
      <header className="text-center opacity-0 animate-fade-up" style={delay(0)}>
        <h1 className="mt-4 text-4xl font-black tracking-[-0.02em] text-lunar-green sm:text-5xl">
          About Us
        </h1>
        <div className="mx-auto mt-6 h-px w-24 bg-matte-gold/50" aria-hidden="true" />
      </header>

      <div className="mt-12 space-y-0">
        {/* Kitchen for Everyone */}
        <section className={`bg-surface px-6 py-14 md:py-16 -mx-6 ${fade}`} style={delay(100)}>
          <div className="mx-auto max-w-4xl">
            <h2 className={h2}>Kitchen for Everyone</h2>
            <p className={lead}>A welcoming space where food brings people together.</p>
            <p className={body}>
              The Malta Food Experience is designed for anyone who wants to
              discover Maltese food, local produce and the traditions behind
              the dishes we know and love.
            </p>
            <p className={body}>
              Whether you are an experienced home cook, a curious beginner or
              simply enjoy discovering new flavours, our kitchen gives you the
              opportunity to work with ingredients from Malta&apos;s fields,
              farms and sea and transform them into authentic Maltese dishes.
            </p>
            <p className={body}>
              Guided by experienced chefs, you will develop practical cooking
              skills, discover traditional and contemporary techniques, and
              learn more about the ingredients that shape Maltese cuisine.
            </p>
            <p className={body}>
              More than a cooking class, it is an opportunity to connect with
              Malta&apos;s food, its traditions and the people behind it.
            </p>
          </div>
        </section>

        {/* Celebrating Malta's Food Heritage */}
        <section className={`bg-soft-beige px-6 py-14 md:py-16 -mx-6 ${fade}`} style={delay(200)}>
          <div className="mx-auto max-w-4xl">
            <h2 className={h2}>Celebrating Malta&apos;s Food Heritage</h2>
            <p className={body}>
              Malta&apos;s food culture has been shaped over generations by
              local ingredients, seasonality, traditional recipes and the
              knowledge of the people who grow, raise, catch and prepare our
              food.
            </p>
            <p className={body}>
              The Malta Food Experience creates a space where this knowledge
              can be shared, experienced and passed on.
            </p>
            <p className={body}>
              Through our cooking experiences, we bring people closer to
              Malta&apos;s seasonal produce, traditional ingredients and
              culinary practices, while sharing the stories and skills behind
              the dishes that form part of our gastronomic heritage.
            </p>
            <p className={body}>
              By making this knowledge accessible to both local communities and
              visitors to the Maltese Islands, we aim to encourage a greater
              appreciation of local food, strengthen the connection between
              consumers and food producers, and help keep Malta&apos;s culinary
              traditions alive for future generations.
            </p>
          </div>
        </section>

        {/* From Local Producers to Your Plate */}
        <section className={`bg-surface px-6 py-14 md:py-16 -mx-6 ${fade}`} style={delay(300)}>
          <div className="mx-auto max-w-4xl">
            <h2 className={h2}>From Local Producers to Your Plate</h2>
            <p className={lead}>Behind every ingredient is a story.</p>
            <p className={body}>
              Wherever possible, our experiences place local and seasonal
              ingredients at the heart of the kitchen, while highlighting the
              food producers who help bring them to our tables.
            </p>
            <p className={body}>
              Participants discover how to prepare Maltese dishes, where their
              ingredients come from, when they are in season and the work that
              goes into producing them.
            </p>
            <p className={body}>
              It is a chance to experience the journey of Maltese food, from
              field, farm and sea to kitchen and table.
            </p>
          </div>
        </section>

        {/* How Does a Cooking Class Work? */}
        <section className={`bg-soft-beige px-6 py-14 md:py-16 -mx-6 ${fade}`} style={delay(400)}>
          <div className="mx-auto max-w-4xl">
            <h2 className={h2}>How Does a Cooking Class Work?</h2>
            <p className={body}>
              Each class is a relaxed, hands-on experience lasting
              approximately three hours. You will discover the ingredients and
              stories behind Maltese dishes, learn practical techniques and
              prepare the recipes yourself with guidance from a qualified chef.
            </p>
            <ol className="mt-10 space-y-8">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-5">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-lunar-green text-lg font-bold text-soft-beige"
                  >
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-lg font-bold text-lunar-green sm:text-xl">
                      <span className="sr-only">{i + 1}. </span>
                      {step.title}
                    </h3>
                    <p className="mt-2 text-base leading-relaxed text-text-light sm:text-lg">
                      {step.text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Who Can Join? / Accompanying Guests / Dietary Requirements */}
        <section className={`bg-surface px-6 py-14 md:py-16 -mx-6 ${fade}`} style={delay(500)}>
          <div className="mx-auto max-w-4xl space-y-12">
            <div>
              <h2 className={h2}>Who Can Join?</h2>
              <p className={lead}>Everyone is welcome.</p>
              <p className={body}>
                Our cooking experiences are open to both residents and visitors
                to the Maltese Islands and are available in Maltese and English.
              </p>
              <p className={body}>
                Each cooking workstation can comfortably accommodate up to two
                participants, making the experience ideal for:
              </p>
              <ul className="mt-4 space-y-2 text-base leading-relaxed text-text-light sm:text-lg">
                {WHO_CAN_JOIN.map((item) => (
                  <Bullet key={item}>{item}</Bullet>
                ))}
              </ul>
              <p className={body}>
                You are encouraged to bring someone along and share the
                experience together.
              </p>
            </div>

            <div>
              <h2 className={h2}>Accompanying Guests</h2>
              <p className={body}>
                Family members, friends or carers who are accompanying
                participants but are not taking part in the cooking activities
                can make use of comfortable seating areas where they can relax
                and observe the experience.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-soft-beige/40 px-4 py-4 sm:px-5 sm:py-5">
              <h2 className="text-xl font-bold tracking-tight text-lunar-green sm:text-2xl">Dietary Requirements &amp; Allergies</h2>
              <p className="mt-2 text-sm leading-relaxed text-text-light sm:text-base">
                We will do our best to accommodate specific dietary
                requirements, food allergies, intolerances and nutritional
                preferences where feasible.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-text-light sm:text-base">
                Please{' '}
                <Link
                  href="/contact"
                  className="font-semibold text-teracotta-dark underline-offset-2 hover:underline focus:outline-2 focus:outline-offset-2 focus:outline-teracotta"
                >
                  get in touch with our team
                </Link>{' '}
                before booking so that our team can assess your requirements
                and help ensure a safe and enjoyable experience.
              </p>
            </div>
          </div>
        </section>

        {/* Discover Malta Through Food */}
        <section className={`bg-soft-beige px-6 py-14 text-center md:py-16 -mx-6 ${fade}`} style={delay(600)}>
          <div className="mx-auto max-w-4xl">
            <h2 className={h2}>Discover Malta Through Food</h2>
            <ul className="mt-6 space-y-1 text-lg font-semibold text-lunar-green sm:text-xl">
              {DISCOVER_POINTS.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <p className={body}>
              Whether you call Malta home or are discovering the islands for the
              first time, the Malta Food Experience offers a different way to
              connect with Maltese culture, through the food that brings us
              together.
            </p>
            <p className={body}>
              Come cook with us and experience the true taste of Malta.
            </p>
            <ExploreCta />

            <div className="mx-auto mt-14 h-px w-32 bg-matte-gold/40" aria-hidden="true" />
            <p className="mt-6 text-sm font-bold text-lunar-green">Malta Food Experience</p>
            <p className="mt-1 text-sm text-text-light">Brought to you by the Malta Food Agency</p>
          </div>
        </section>
      </div>
    </article>
  )
}