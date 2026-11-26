import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
export const metadata = { title: 'About · Garage Sale' };
const STEPS = [['📸', 'Snap', 'Take one photo.'], ['✅', 'Approve', 'Check the listing.'], ['💸', 'Sold', 'Buyers message you.']];
export default function About() {
  return <main className="wrap py-20 md:py-32">
    <section className="text-center"><h1 className="!text-5xl !font-semibold !tracking-tight md:!text-8xl">Snap it.<br /><span className="text-muted-foreground">Grok Bot sells it.</span></h1></section>
    <section className="mx-auto mt-20 grid max-w-4xl gap-4 md:grid-cols-3">{STEPS.map(([ic, t, p]) => <Card key={t} className="border-border/60 p-8 text-center"><div className="text-4xl" aria-hidden="true">{ic}</div><div className="mt-6 text-xl font-semibold">{t}</div><p className="mt-1 text-muted-foreground">{p}</p></Card>)}</section>
    <section className="mx-auto mt-20 max-w-xl text-center">
      <p className="text-muted-foreground">Built in 2.5 hours with Grok Bot at the <a className="text-foreground underline-offset-4 hover:underline" href="https://luma.com/x0qss5av?tk=Mdaf1N" target="_blank" rel="noreferrer">Grok Bot Hackathon</a>.</p>
      <div className="mt-6 flex items-center justify-center gap-4 text-sm"><a className="underline-offset-4 hover:underline" href="https://adampang.com" target="_blank" rel="noreferrer">Adam Pang</a><Separator orientation="vertical" className="h-4" /><span>Pranav</span><Separator orientation="vertical" className="h-4" /><span>Isaac</span></div>
      <Button asChild size="lg" className="mt-10"><a href="https://github.com/adamtpang/grokbothackathon" target="_blank" rel="noreferrer">View on GitHub</a></Button>
    </section>
  </main>;
}
