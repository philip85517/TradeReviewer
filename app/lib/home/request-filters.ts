import type {HomeFilters} from '../../components/homepage-preview/display-contract';

const assetTypes=new Set(['股票','ETF','基金']);
const fields=new Set(['assetTypes','openOnly','review']);

/** Canonical request semantics only; this does not add filtering or stamp support. */
export function normalizeHomeFilters(value:unknown):HomeFilters {
 if(value===undefined)return{assetTypes:[],openOnly:false,review:'all'};
 if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError('无效的首页筛选参数');
 const filters=value as Record<string,unknown>;
 if(Object.keys(filters).some(key=>!fields.has(key))||
  !Array.isArray(filters.assetTypes)||!filters.assetTypes.every(type=>typeof type==='string'&&assetTypes.has(type))||
  typeof filters.openOnly!=='boolean'||!(filters.review==='all'||filters.review==='pending'||filters.review==='done'))throw new TypeError('无效的首页筛选参数');
 return{assetTypes:[...new Set(filters.assetTypes)].sort(),openOnly:filters.openOnly,review:filters.review};
}
