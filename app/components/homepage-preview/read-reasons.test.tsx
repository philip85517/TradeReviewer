import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {ReadReasons} from './read-reasons';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('keeps every reason accessible and restores the trigger on Escape',()=>{
 const reasons=Array.from({length:20},(_,i)=>`第 ${i+1} 项缺失原因与完整说明`);
 render(<ReadReasons reasons={reasons}/>);
 const trigger=screen.getByText('查看原因');fireEvent.click(trigger);
 for(const reason of reasons)expect(screen.getByText(reason)).toBeInTheDocument();
 const close=screen.getByRole('button',{name:'关闭原因说明'});close.focus();fireEvent.keyDown(close,{key:'Escape'});
 expect(trigger.closest('details')).not.toHaveAttribute('open');expect(trigger).toHaveFocus();
});

it('keeps the panel inside the usable layout when a stable scrollbar reserves width',()=>{
 render(<ReadReasons reasons={['缺少成本']}/>);
 const trigger=screen.getByText('查看原因'), panel=screen.getByLabelText('数据缺失原因');
 vi.spyOn(window,'innerWidth','get').mockReturnValue(390);
 vi.spyOn(document.documentElement,'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({width:375,height:844}));
 vi.spyOn(trigger,'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({x:195,y:404,width:61,height:36}));
 vi.spyOn(panel,'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({width:351,height:440}));
 const details=trigger.closest('details')!;details.open=true;fireEvent(details,new Event('toggle'));
 expect(panel.style.right).toBe('12px');
});
