import {TradeReviewWorkspace} from '../components/trade-review-workspace';
import {getDemoReplayFrame} from '../lib/demo/server-replay-provider';
import {fullLibraryEntry} from '../components/homepage-preview/full-library';
export default async function Trades({searchParams}:{searchParams?:Promise<Record<string,string|string[]|undefined>>}){
 const entry=fullLibraryEntry(await searchParams??{});
 return <TradeReviewWorkspace initialFrame={getDemoReplayFrame()} showDemo={false} homeLibraryEntry={entry}/>;
}
