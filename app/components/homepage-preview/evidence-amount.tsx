import Decimal from 'decimal.js';

export function formatEvidenceAmount(value: string) {
 return new Decimal(value).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');
}

/** Round only the default readout; the original decimal remains inspectable. */
export function EvidenceAmount({value,currency}:{value:string;currency:string}) {
 const amount=new Decimal(value),full=`${value} ${currency}`;
 const shown=formatEvidenceAmount(value);
 if(amount.decimalPlaces()<=2)return <span>{shown} {currency}</span>;
 return <details className="hp-evidence-precision"><summary>{shown} {currency}<small>完整精度</small></summary><span>{full}</span></details>;
}
