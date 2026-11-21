import {FullHomepage} from '../components/homepage-preview/full-homepage';
import {firstFullReadScript} from '../lib/home/first-full-read';
// The embedded Shanghai business day is request-time data, never a static export.
export const dynamic='force-dynamic';
export default function Home(){const day=new Date(Date.now()+8*3600000).toISOString().slice(0,10);return <><script dangerouslySetInnerHTML={{__html:firstFullReadScript(day)}}/><FullHomepage/></>;}
