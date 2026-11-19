import { redirect } from 'next/navigation';

// The deals moved to the home page. Old links still land there.
export default function Dashboard() { redirect('/'); }
