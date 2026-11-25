import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {EvidenceAmount,formatEvidenceAmount} from './evidence-amount';
afterEach(cleanup);
it('groups complete amounts and consistently displays cents including zero',()=>{
 render(<><EvidenceAmount value="0" currency="HKD"/><EvidenceAmount value="233662" currency="CNY"/></>);
 expect(screen.getByText('0.00 HKD')).toBeInTheDocument();
 expect(screen.getByText('233,662.00 CNY')).toBeInTheDocument();
 expect(formatEvidenceAmount('-12345.6')).toBe('-12,345.60');
});
it('keeps the exact decimal inspectable when the default readout rounds',()=>{
 render(<EvidenceAmount value="233662.123456789" currency="CNY"/>);
 expect(screen.getByText('完整精度').closest('summary')).toHaveTextContent('233,662.12 CNY');
 expect(screen.getByText('233662.123456789 CNY').closest('details')).toBeInTheDocument();
});
