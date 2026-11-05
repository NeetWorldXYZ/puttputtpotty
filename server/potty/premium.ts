export const premiumKeys = { welcomeTour:'starter', regaliaTour:'royal_style' } as const;
export type PremiumKey=keyof typeof premiumKeys;
export function premiumProduct(key:unknown){return typeof key==='string' && Object.prototype.hasOwnProperty.call(premiumKeys,key)?premiumKeys[key as PremiumKey]:null;}
