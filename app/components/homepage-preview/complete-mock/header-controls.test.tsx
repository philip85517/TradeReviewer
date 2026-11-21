import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { HeaderControls } from './header-controls';
import { DEFAULT_REQUEST } from '../mock-source';
import { mockInstruments } from './mock-source';
afterEach(cleanup);
const accounts=[{id:'all',name:'全部实盘账户'},{id:'account-1',name:'招商证券 · 实盘'}];
it('keeps unapplied filter draft on Escape and commits dimensions together', async()=>{
  const change=vi.fn();render(<HeaderControls request={DEFAULT_REQUEST} accounts={accounts} instruments={mockInstruments('normal')} pending={false} error={null} onChange={change} onOpenInstrument={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button',{name:'附加筛选'}));
  fireEvent.click(screen.getByRole('checkbox',{name:'ETF'}));
  fireEvent.keyDown(screen.getByRole('dialog',{name:'附加筛选'}),{key:'Escape'});
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'附加筛选'}));
  expect(screen.getByRole('checkbox',{name:'ETF'})).toBeChecked();
  fireEvent.click(screen.getByRole('button',{name:'应用筛选'}));
  expect(change).toHaveBeenCalledWith({filters:{assetTypes:['ETF'],openOnly:false,review:'all'}});
});
it('global search includes exchange identity without altering home scope', async()=>{
  const change=vi.fn(),open=vi.fn();render(<HeaderControls request={{...DEFAULT_REQUEST,market:'CN'}} accounts={accounts} instruments={mockInstruments('normal')} pending={false} error={null} onChange={change} onOpenInstrument={open}/>);
  fireEvent.click(screen.getByRole('button',{name:'全局标的搜索'}));
  fireEvent.change(screen.getByRole('searchbox',{name:'搜索全部标的'}),{target:{value:'AAPL'}});
  await waitFor(()=>expect(screen.getAllByRole('button',{name:/Apple Inc.*NASDAQ/}).length).toBeGreaterThan(0));
  const result=screen.getAllByRole('button',{name:/Apple Inc.*NASDAQ/})[0];
  expect(within(result).getByText(/USD/)).toBeVisible();fireEvent.click(result);
  expect(open.mock.calls[0][0]).toContain('AAPL');expect(change).not.toHaveBeenCalled();
});
