import ItemScreen from './ItemScreen';

export const metadata = { title: 'Deal · Garage Sale' };
// The deal id is in the query (?id=), since a listing's id is its URL.
export default function Item() { return <main className="wrap py-10 md:py-16"><ItemScreen /></main>; }
