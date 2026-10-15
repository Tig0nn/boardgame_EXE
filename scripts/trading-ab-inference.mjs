// Marginal 97.5% Wilson bounds on paired discordance rates, combined
// with Bonferroni for a conservative nominal 95% difference interval.
export function matchedWinInterval(fresh,old){
  if(!fresh.length||fresh.length!==old.length)throw Error('Unmatched seed count')
  const prior=new Map(old.map(r=>[r.seed,r]));let gains=0,losses=0
  for(const r of fresh){const b=prior.get(r.seed);if(!b)throw Error('Unmatched seed');gains+=Number(r.won&&!b.won);losses+=Number(!r.won&&b.won)}
  const n=fresh.length,z=2.241402727604947,interval=k=>{
    const p=k/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d
    return [k===0?0:Math.max(0,c-h),k===n?1:Math.min(1,c+h)]
  }
  const g=interval(gains),l=interval(losses)
  return {n,gains,losses,mean:(gains-losses)/n,ci95:[g[0]-l[1],g[1]-l[0]],method:'conservative nominal 95% Bonferroni-Wilson on paired discordance rates'}
}
