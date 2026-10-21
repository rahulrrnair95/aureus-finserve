// Client-side financial math for calculators. Results are illustrative only.

/** Future value of monthly SIP (payment at start of month). Returns yearly series too. */
export function sipCalc({ monthly, ratePct, years }) {
  const r = ratePct / 100 / 12;
  const series = [];
  let value = 0;
  let invested = 0;
  for (let m = 1; m <= years * 12; m++) {
    value = (value + monthly) * (1 + r);
    invested += monthly;
    if (m % 12 === 0) series.push({ year: m / 12, invested: Math.round(invested), value: Math.round(value) });
  }
  return { invested, value, gain: value - invested, series };
}

export function lumpsumCalc({ amount, ratePct, years }) {
  const series = [];
  for (let y = 1; y <= years; y++) {
    series.push({ year: y, invested: amount, value: Math.round(amount * Math.pow(1 + ratePct / 100, y)) });
  }
  const value = amount * Math.pow(1 + ratePct / 100, years);
  return { invested: amount, value, gain: value - amount, series };
}

/** Monthly SIP required to reach target (target in today's money inflated if inflationPct given). */
export function goalCalc({ target, years, ratePct, inflationPct = 0, existing = 0 }) {
  const futureTarget = target * Math.pow(1 + inflationPct / 100, years);
  const r = ratePct / 100 / 12;
  const n = years * 12;
  const existingFv = existing * Math.pow(1 + ratePct / 100, years);
  const gap = Math.max(0, futureTarget - existingFv);
  const factor = r === 0 ? n : ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
  const monthly = gap / factor;
  const sim = sipCalc({ monthly, ratePct, years });
  return { futureTarget, monthly, invested: monthly * n, series: sim.series.map((s) => ({ ...s, target: Math.round(futureTarget) })) };
}

/** Step-up SIP: monthly amount increases by stepPct every 12 months. */
export function stepUpCalc({ monthly, stepPct, ratePct, years }) {
  const r = ratePct / 100 / 12;
  let value = 0;
  let invested = 0;
  let amt = monthly;
  let flatValue = 0;
  const series = [];
  for (let m = 1; m <= years * 12; m++) {
    value = (value + amt) * (1 + r);
    flatValue = (flatValue + monthly) * (1 + r);
    invested += amt;
    if (m % 12 === 0) {
      series.push({ year: m / 12, invested: Math.round(invested), value: Math.round(value), flat: Math.round(flatValue) });
      amt = amt * (1 + stepPct / 100);
    }
  }
  return { invested, value, gain: value - invested, flatValue, finalMonthly: amt / (1 + stepPct / 100), series };
}

/** Closed-form SIP FV = P × ((1+i)^n − 1)/i × (1+i), i = r/12, n = months (payment at start of month). */
export function sipFv(monthly, ratePct, months) {
  const i = ratePct / 100 / 12;
  if (months <= 0) return 0;
  if (i === 0) return monthly * months;
  return monthly * ((Math.pow(1 + i, months) - 1) / i) * (1 + i);
}

/** Goal: future cost = C × (1+f)^t ; SIP needed and lump sum needed today. */
export function goalPlan({ cost, years, inflationPct, ratePct }) {
  const futureCost = cost * Math.pow(1 + inflationPct / 100, years);
  const months = years * 12;
  const unit = sipFv(1, ratePct, months);
  const monthlySip = unit > 0 ? futureCost / unit : futureCost;
  const lumpsumNeeded = futureCost / Math.pow(1 + ratePct / 100, years);
  const series = [];
  for (let y = 1; y <= years; y++) {
    series.push({ year: y, value: Math.round(sipFv(monthlySip, ratePct, y * 12)), invested: Math.round(monthlySip * y * 12), target: Math.round(futureCost) });
  }
  return { futureCost, monthlySip, lumpsumNeeded, series };
}

/** ELSS 80C tax saving: old regime only, cap ₹1.5 lakh, includes 4% health & education cess. */
export const ELSS_CAP = 150000;
export function elssCalc({ annualInvestment, slabPct, regime }) {
  const eligible = Math.min(Math.max(0, annualInvestment), ELSS_CAP);
  if (regime === 'NEW') return { eligible: 0, taxSaved: 0, cess: 0, baseSaved: 0 };
  const baseSaved = eligible * (slabPct / 100);
  const cess = baseSaved * 0.04;
  return { eligible, baseSaved, cess, taxSaved: baseSaved + cess };
}

/** Cost of delay: same monthly SIP started now vs after `delayMonths`, both ending at the same horizon. */
export function costOfDelayCalc({ monthly, ratePct, years, delayMonths }) {
  const n = years * 12;
  const now = sipFv(monthly, ratePct, n);
  const later = sipFv(monthly, ratePct, Math.max(0, n - delayMonths));
  const unitLater = sipFv(1, ratePct, Math.max(0, n - delayMonths));
  const requiredMonthly = unitLater > 0 ? now / unitLater : null; // SIP needed if delayed, to reach the same corpus
  const series = [];
  for (let y = 1; y <= years; y++) {
    const m = y * 12;
    series.push({ year: y, now: Math.round(sipFv(monthly, ratePct, m)), delayed: Math.round(sipFv(monthly, ratePct, Math.max(0, m - delayMonths))) });
  }
  return { now, later, cost: now - later, requiredMonthly, investedNow: monthly * n, investedLater: monthly * Math.max(0, n - delayMonths), series };
}

/** SWP month-by-month table. */
export function swpSchedule({ corpus, withdrawal, ratePct, years }) {
  const r = ratePct / 100 / 12;
  let bal = corpus;
  const rows = [];
  for (let m = 1; m <= years * 12; m++) {
    const opening = bal;
    const growth = bal * r;
    const w = Math.min(withdrawal, bal + growth);
    bal = Math.max(0, bal + growth - w);
    rows.push({ month: m, opening, growth, withdrawal: w, closing: bal });
    if (bal <= 0) break;
  }
  return rows;
}

/** SWP: start corpus, monthly withdrawal, returns. */
export function swpCalc({ corpus, withdrawal, ratePct, years }) {
  const r = ratePct / 100 / 12;
  let bal = corpus;
  let withdrawn = 0;
  let depletedAt = null;
  const series = [{ year: 0, balance: Math.round(corpus), withdrawn: 0 }];
  for (let m = 1; m <= years * 12; m++) {
    bal = bal * (1 + r);
    const w = Math.min(withdrawal, bal);
    bal -= w;
    withdrawn += w;
    if (bal <= 0 && depletedAt === null) depletedAt = m;
    if (m % 12 === 0) series.push({ year: m / 12, balance: Math.round(Math.max(0, bal)), withdrawn: Math.round(withdrawn) });
    if (bal <= 0) bal = 0;
  }
  return { finalBalance: Math.max(0, bal), withdrawn, depletedAt, series };
}

/** Retirement corpus needed at retirement, and monthly SIP to build it. */
export function retirementCalc({ age, retireAge, lifeExpectancy, monthlyExpense, inflationPct, preReturnPct, postReturnPct, existing = 0 }) {
  const yrsToRetire = Math.max(1, retireAge - age);
  const yrsInRetirement = Math.max(1, lifeExpectancy - retireAge);
  const expenseAtRetire = monthlyExpense * Math.pow(1 + inflationPct / 100, yrsToRetire);
  // Real monthly return post retirement (growing annuity, inflation-adjusted withdrawals)
  const realAnnual = (1 + postReturnPct / 100) / (1 + inflationPct / 100) - 1;
  const rr = Math.pow(1 + realAnnual, 1 / 12) - 1;
  const n = yrsInRetirement * 12;
  const corpus = rr === 0 ? expenseAtRetire * n : expenseAtRetire * ((1 - Math.pow(1 + rr, -n)) / rr) * (1 + rr);
  const g = goalCalc({ target: corpus, years: yrsToRetire, ratePct: preReturnPct, inflationPct: 0, existing });
  return { expenseAtRetire, corpus, monthlySip: g.monthly, yrsToRetire, yrsInRetirement, series: g.series };
}
