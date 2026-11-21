import Decimal from 'decimal.js';

/** Round only the default readout; the original decimal remains inspectable. */
export function EvidenceAmount({value,currency}:{value:string;currency:string}) {
 const amount=new Decimal(value),full=`${value} ${currency}`;
 if(amount.decimalPlaces()<=2)return <span>{full}</span>;
 const shown=amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');
 return <details className="hp-evidence-precision"><summary>{shown} {currency}<small>完整精度</small></summary><span>{full}</span></details>;
}
