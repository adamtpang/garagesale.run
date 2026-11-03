import BuySearch from '../../components/BuySearch';
import ModeFeed from '../../components/ModeFeed';
export const metadata = { title: 'Buy · Garage Sale' };
export default function Buy() {
  return <main>
    <section className="hero home-hero !pb-10 !pt-16 md:!pt-24"><div className="wrap mx-auto max-w-3xl">
      <div className="text-center"><h1 className="!text-5xl !font-semibold !tracking-tight md:!text-7xl">Find flips.</h1>
        <p className="mx-auto mt-5 max-w-md text-lg text-muted-foreground md:text-xl">Say what you want. Grok Bot finds it under market, shows the proof, and drafts the first message for you to send.</p></div>
      <div className="mt-10"><BuySearch /></div>
    </div></section>
    <ModeFeed mode="buy" />
  </main>;
}
