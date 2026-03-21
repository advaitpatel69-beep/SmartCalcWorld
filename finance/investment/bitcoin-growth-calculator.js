const state = {
  currentCurrency: "USD",
  activeMode: "historical",
  charts: { growth: null, profit: null, comparison: null, drawdown: null },
  csvRows: [],
  csvFilename: "bitcoin_growth_projection.csv",
  copyText: "",
  calculateTimer: null,
  cache: new Map()
};

const currencyConfig = {
  USD: { symbol: "$", locale: "en-US" },
  EUR: { symbol: "\u20AC", locale: "de-DE" },
  GBP: { symbol: "\u00A3", locale: "en-GB" },
  INR: { symbol: "\u20B9", locale: "en-IN" },
  CAD: { symbol: "$", locale: "en-CA" },
  AUD: { symbol: "$", locale: "en-AU" }
};

const btcReference = [
  ["2010-07-17", 0.08], ["2010-10-01", 0.06], ["2011-01-01", 0.30], ["2011-04-01", 0.79], ["2011-06-01", 8.80],
  ["2011-08-01", 11.00], ["2011-11-01", 3.20], ["2012-01-01", 5.27], ["2012-04-01", 4.90], ["2012-07-01", 6.60],
  ["2012-10-01", 12.30], ["2013-01-01", 13.45], ["2013-04-01", 106.00], ["2013-07-01", 88.00], ["2013-10-01", 141.00],
  ["2013-12-01", 955.00], ["2014-01-01", 770.44], ["2014-04-01", 454.00], ["2014-07-01", 640.00], ["2014-10-01", 338.00],
  ["2015-01-01", 320.19], ["2015-04-01", 244.00], ["2015-07-01", 288.00], ["2015-10-01", 236.00], ["2016-01-01", 430.57],
  ["2016-04-01", 417.00], ["2016-07-01", 671.00], ["2016-10-01", 606.00], ["2017-01-01", 997.69], ["2017-03-01", 1225.00],
  ["2017-06-01", 2400.00], ["2017-09-01", 4700.00], ["2017-12-01", 14000.00], ["2018-01-01", 13412.44], ["2018-04-01", 6939.00],
  ["2018-07-01", 6366.00], ["2018-10-01", 6615.00], ["2018-12-01", 3742.70], ["2019-01-01", 3742.70], ["2019-04-01", 4100.00],
  ["2019-07-01", 10756.00], ["2019-10-01", 8300.00], ["2020-01-01", 7194.89], ["2020-03-15", 5200.00], ["2020-06-01", 9500.00],
  ["2020-09-01", 11600.00], ["2020-12-31", 29000.00], ["2021-01-01", 29374.15], ["2021-04-14", 63500.00], ["2021-07-20", 29800.00],
  ["2021-11-10", 69000.00], ["2021-12-31", 47000.00], ["2022-01-01", 46217.50], ["2022-04-01", 45500.00], ["2022-06-18", 19000.00],
  ["2022-09-01", 20000.00], ["2022-11-21", 15700.00], ["2022-12-31", 16547.50], ["2023-01-01", 16547.50], ["2023-04-01", 28300.00],
  ["2023-07-01", 30500.00], ["2023-10-01", 27000.00], ["2023-12-31", 42258.00], ["2024-01-01", 42258.00], ["2024-03-15", 71000.00],
  ["2024-06-01", 67400.00], ["2024-09-01", 59000.00], ["2024-12-31", 93700.00], ["2025-03-01", 84250.00], ["2025-06-01", 104000.00],
  ["2025-09-01", 82500.00], ["2025-12-31", 93500.00], ["2026-03-21", 84250.00]
].map(([date, price]) => ({ date, price, time: new Date(date + "T00:00:00").getTime() }));

const firstHistoricalDate = btcReference[0].date;
const lastHistoricalDate = btcReference[btcReference.length - 1].date;
const resultCardThemes = ["teal", "sky", "amber", "rose", "slate", "teal", "sky", "amber"];

const sliderConfigs = [
  { input: "hist-investment", slider: "hist-investment-sl", label: "hist-investment-lbl", type: "money" },
  { input: "hist-dca", slider: "hist-dca-sl", label: "hist-dca-lbl", type: "money" },
  { input: "hist-stock-rate", slider: "hist-stock-rate-sl", label: "hist-stock-rate-lbl", type: "percent" },
  { input: "hist-inflation", slider: "hist-inflation-sl", label: "hist-inflation-lbl", type: "percent" },
  { input: "fut-investment", slider: "fut-investment-sl", label: "fut-investment-lbl", type: "money" },
  { input: "fut-dca", slider: "fut-dca-sl", label: "fut-dca-lbl", type: "money" },
  { input: "fut-growth-rate", slider: "fut-growth-rate-sl", label: "fut-growth-rate-lbl", type: "percent" },
  { input: "fut-stock-rate", slider: "fut-stock-rate-sl", label: "fut-stock-rate-lbl", type: "percent" },
  { input: "fut-inflation", slider: "fut-inflation-sl", label: "fut-inflation-lbl", type: "percent" },
  { input: "cmp-investment", slider: "cmp-investment-sl", label: "cmp-investment-lbl", type: "money" },
  { input: "cmp-sip", slider: "cmp-sip-sl", label: "cmp-sip-lbl", type: "money" },
  { input: "cmp-fixed-rate", slider: "cmp-fixed-rate-sl", label: "cmp-fixed-rate-lbl", type: "percent" },
  { input: "cmp-bitcoin-rate", slider: "cmp-bitcoin-rate-sl", label: "cmp-bitcoin-rate-lbl", type: "percent" },
  { input: "cmp-inflation", slider: "cmp-inflation-sl", label: "cmp-inflation-lbl", type: "percent" }
];

const cacheInputIds = {
  historical: ["hist-investment", "hist-dca", "hist-start", "hist-end", "hist-stock-rate", "hist-inflation"],
  future: ["fut-investment", "fut-dca", "fut-start", "fut-end", "fut-growth-rate", "fut-stock-rate", "fut-inflation", "fut-model-style"],
  comparison: ["cmp-investment", "cmp-sip", "cmp-start", "cmp-end", "cmp-fixed-rate", "cmp-bitcoin-rate", "cmp-inflation", "cmp-source", "cmp-model-style"]
};

function $(id) { return document.getElementById(id); }
function parseDate(dateString) { return new Date(dateString + "T00:00:00"); }
function toDateInput(date) { return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
function yearsBetween(startDate, endDate) { return (parseDate(endDate).getTime() - parseDate(startDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25); }
function getNumeric(id) { const value = parseFloat($(id).value); return Number.isFinite(value) ? value : 0; }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function safeDivide(numerator, denominator) { return denominator ? numerator / denominator : 0; }
function annualToMonthlyRate(annualRate) { return annualRate <= -1 ? -1 : Math.pow(1 + annualRate, 1 / 12) - 1; }
function hashString(text) { let hash = 2166136261; for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); } return hash >>> 0; }
function pseudoRandomSigned(seed) { const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; }

function addMonthsClamped(baseDate, monthOffset) {
  const start = new Date(baseDate.getTime());
  const day = start.getDate();
  const target = new Date(start.getFullYear(), start.getMonth() + monthOffset, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return target;
}

function addYearsClamped(baseDate, yearOffset) {
  const start = new Date(baseDate.getTime());
  const month = start.getMonth();
  const day = start.getDate();
  const target = new Date(start.getFullYear() + yearOffset, month, 1);
  const lastDay = new Date(target.getFullYear(), month + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return target;
}

function buildMonthlyDates(startDate, endDate) {
  const dates = [startDate];
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  let monthIndex = 1;
  while (true) {
    const next = addMonthsClamped(start, monthIndex);
    if (next.getTime() >= end.getTime()) break;
    dates.push(toDateInput(next));
    monthIndex += 1;
  }
  if (dates[dates.length - 1] !== endDate) dates.push(endDate);
  return dates;
}

function buildYearlyDates(startDate, endDate) {
  const dates = [startDate];
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  let yearIndex = 1;
  while (true) {
    const next = addYearsClamped(start, yearIndex);
    if (next.getTime() >= end.getTime()) break;
    dates.push(toDateInput(next));
    yearIndex += 1;
  }
  if (dates[dates.length - 1] !== endDate) dates.push(endDate);
  return dates;
}

function formatNumber(value, digits = 2) {
  const cfg = currencyConfig[state.currentCurrency];
  return new Intl.NumberFormat(cfg.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number.isFinite(value) ? value : 0);
}

function formatMoney(value, digits = 2) {
  const cfg = currencyConfig[state.currentCurrency];
  return `${value < 0 ? "-" : ""}${cfg.symbol}${formatNumber(Math.abs(value), digits)}`;
}

function formatPercentDecimal(decimal, digits = 2) { return `${(decimal * 100).toFixed(digits)}%`; }
function formatPercentValue(value, digits = 2) { return `${Number(value || 0).toFixed(digits)}%`; }
function formatMultiple(value) { return `${(value >= 10 ? value.toFixed(1) : value.toFixed(2))}x`; }
function formatBtcUnits(value) { return `${new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 6 }).format(Number.isFinite(value) ? value : 0)} BTC`; }
function formatDateLabel(dateString) { const date = parseDate(dateString); return date.toLocaleDateString("en-US", { month: "short", year: "numeric" }); }

function updateCurrencyIndicators() {
  const symbol = currencyConfig[state.currentCurrency].symbol;
  document.querySelectorAll("[data-currency-symbol]").forEach((node) => { node.textContent = symbol; });
}

function updateSliderLabel(config) {
  const value = parseFloat($(config.input).value) || 0;
  $(config.label).textContent = config.type === "money" ? formatMoney(value) : formatPercentValue(value);
}

function bindSliderPair(config) {
  const input = $(config.input);
  const slider = $(config.slider);
  input.addEventListener("input", () => {
    slider.value = input.value;
    updateSliderLabel(config);
    state.cache.clear();
    queueCalculate();
  });
  slider.addEventListener("input", () => {
    input.value = slider.value;
    updateSliderLabel(config);
    state.cache.clear();
    queueCalculate();
  });
  updateSliderLabel(config);
}

function getHistoricalPrice(dateString) {
  const target = parseDate(dateString).getTime();
  if (target <= btcReference[0].time) return btcReference[0].price;
  if (target >= btcReference[btcReference.length - 1].time) return btcReference[btcReference.length - 1].price;
  for (let i = 0; i < btcReference.length - 1; i += 1) {
    const current = btcReference[i];
    const next = btcReference[i + 1];
    if (target >= current.time && target <= next.time) {
      const ratio = safeDivide(target - current.time, next.time - current.time);
      return current.price + (next.price - current.price) * ratio;
    }
  }
  return btcReference[btcReference.length - 1].price;
}

function buildHistoricalPriceSeries(startDate, endDate) {
  return buildMonthlyDates(startDate, endDate).map((date, index, dates) => {
    const price = getHistoricalPrice(date);
    const prevPrice = index > 0 ? getHistoricalPrice(dates[index - 1]) : price;
    return {
      date,
      years: yearsBetween(startDate, date),
      price,
      monthlyReturn: index > 0 ? safeDivide(price - prevPrice, prevPrice) : 0
    };
  });
}

function buildProjectedPriceSeries(startDate, endDate, startPrice, annualRate, style, seedSalt = "") {
  const dates = buildMonthlyDates(startDate, endDate);
  const baseMonthlyRate = annualToMonthlyRate(annualRate);
  const seedBase = hashString(`${startDate}|${endDate}|${annualRate}|${style}|${seedSalt}`);
  let price = startPrice;
  const rows = [{ date: dates[0], years: 0, price, monthlyReturn: 0 }];
  for (let i = 1; i < dates.length; i += 1) {
    const years = yearsBetween(startDate, dates[i]);
    const cyclePrimary = Math.sin((years / 4.1) * Math.PI * 2);
    const cycleSecondary = Math.sin((years / 1.45) * Math.PI * 2 + 1.15);
    const noise = pseudoRandomSigned(seedBase + i * 7919);
    let adjustment = 0;
    if (style === "cycle") adjustment = 0.018 * cyclePrimary + 0.008 * cycleSecondary;
    if (style === "volatile") adjustment = 0.026 * cyclePrimary + 0.012 * cycleSecondary + 0.038 * noise;
    const shock = style === "volatile" && i % 17 === 0 ? -0.06 + 0.12 * pseudoRandomSigned(seedBase + i * 131) : 0;
    const monthlyReturn = clamp(baseMonthlyRate + adjustment + shock, -0.45, 0.55);
    price = Math.max(1, price * (1 + monthlyReturn));
    rows.push({ date: dates[i], years, price, monthlyReturn });
  }
  return rows;
}

function simulateBitcoinPlan(priceSeries, initialInvestment, monthlyContribution) {
  const lumpUnits = initialInvestment > 0 ? initialInvestment / priceSeries[0].price : 0;
  let units = lumpUnits;
  let totalInvested = initialInvestment;
  return priceSeries.map((row, index) => {
    if (index > 0 && monthlyContribution > 0) {
      units += monthlyContribution / row.price;
      totalInvested += monthlyContribution;
    }
    const lumpValue = lumpUnits * row.price;
    const value = units * row.price;
    return {
      date: row.date,
      years: row.years,
      btcPrice: row.price,
      monthlyReturn: row.monthlyReturn,
      lumpUnits,
      units,
      lumpValue,
      value,
      dcaValue: Math.max(0, value - lumpValue),
      totalInvested,
      profit: value - totalInvested,
      lumpProfit: lumpValue - initialInvestment
    };
  });
}

function simulateFixedReturnPlan(initialInvestment, monthlyContribution, annualRate, dates) {
  const monthlyRate = annualToMonthlyRate(annualRate);
  let value = initialInvestment;
  let totalInvested = initialInvestment;
  return dates.map((date, index) => {
    if (index > 0) {
      if (monthlyContribution > 0) {
        value += monthlyContribution;
        totalInvested += monthlyContribution;
      }
      value *= 1 + monthlyRate;
    }
    return {
      date,
      years: yearsBetween(dates[0], date),
      value,
      totalInvested,
      profit: value - totalInvested
    };
  });
}

function computeStandardDeviation(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function applyDrawdown(series, valueKey, fieldName) {
  let peak = 0;
  let maxDrawdown = 0;
  series.forEach((row) => {
    peak = Math.max(peak, row[valueKey]);
    row[fieldName] = peak > 0 ? (peak - row[valueKey]) / peak : 0;
    maxDrawdown = Math.max(maxDrawdown, row[fieldName]);
  });
  return maxDrawdown;
}

function findSeriesRowAtOrBefore(series, targetDate) {
  const targetTime = parseDate(targetDate).getTime();
  let chosen = series[0];
  for (let i = 0; i < series.length; i += 1) {
    const rowTime = parseDate(series[i].date).getTime();
    if (rowTime <= targetTime) chosen = series[i];
    if (rowTime >= targetTime) break;
  }
  return chosen;
}

function snapshotLabel(index, total, years) {
  if (index === 0) return "Start";
  if (index === total - 1 && Math.abs(years - Math.round(years)) > 0.01) return `Final (${years.toFixed(1)}y)`;
  return `Year ${Math.max(1, Math.round(years))}`;
}

function buildSnapshotsFromSeries(series, startDate, endDate, valueKey) {
  const targets = buildYearlyDates(startDate, endDate);
  const rows = [];
  const seen = new Set();
  targets.forEach((date) => {
    const row = findSeriesRowAtOrBefore(series, date);
    if (row && !seen.has(row.date)) {
      seen.add(row.date);
      rows.push({ ...row });
    }
  });
  return rows.map((row, index) => {
    const previous = rows[index - 1];
    const currentValue = row[valueKey];
    const previousValue = previous ? previous[valueKey] : currentValue;
    const invested = row.totalInvested || row.btcLumpInvested || 0;
    return {
      ...row,
      yearLabel: snapshotLabel(index, rows.length, row.years),
      annualReturn: previous ? safeDivide(currentValue - previousValue, previousValue) : 0,
      cumulativeCagr: row.years > 0 && invested > 0 && currentValue > 0 ? Math.pow(currentValue / invested, 1 / row.years) - 1 : 0
    };
  });
}

function computeYearReturnStats(snapshots, key) {
  if (snapshots.length < 2) return { bestLabel: "N/A", bestReturn: 0, worstLabel: "N/A", worstReturn: 0 };
  const returns = [];
  for (let i = 1; i < snapshots.length; i += 1) {
    const previous = snapshots[i - 1][key];
    const current = snapshots[i][key];
    if (previous > 0) returns.push({ label: snapshots[i].yearLabel, value: current / previous - 1 });
  }
  if (!returns.length) return { bestLabel: "N/A", bestReturn: 0, worstLabel: "N/A", worstReturn: 0 };
  const best = returns.reduce((acc, row) => (row.value > acc.value ? row : acc), returns[0]);
  const worst = returns.reduce((acc, row) => (row.value < acc.value ? row : acc), returns[0]);
  return { bestLabel: best.label, bestReturn: best.value, worstLabel: worst.label, worstReturn: worst.value };
}

function computeRiskScore(volatility, maxDrawdown) {
  return clamp(Math.round(volatility * 70 + maxDrawdown * 65), 1, 99);
}

function computeQualityScore(returnPct, benchmarkGapPct, capitalEfficiency, volatility, maxDrawdown) {
  const returnScore = clamp((returnPct + 0.5) * 40, 0, 100);
  const benchmarkScore = clamp((benchmarkGapPct + 0.25) * 60, 0, 100);
  const efficiencyScore = clamp(capitalEfficiency * 16, 0, 100);
  const stabilityScore = clamp(100 - (volatility * 55 + maxDrawdown * 45), 0, 100);
  return clamp(Math.round(returnScore * 0.45 + benchmarkScore * 0.2 + efficiencyScore * 0.2 + stabilityScore * 0.15), 0, 100);
}

function scoreLabel(score) {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Strong";
  if (score >= 50) return "Balanced";
  if (score >= 35) return "Speculative";
  return "Fragile";
}

function buildReturnPercentNote(result) {
  if (!result || !Number.isFinite(result.totalInvested) || result.totalInvested <= 0) {
    return "Total percentage gain or loss relative to total capital invested.";
  }
  return `Computed as ${formatMoney(result.profit)} divided by ${formatMoney(result.totalInvested)}, then multiplied by 100. Large percentages are normal when the invested amount is small relative to the gain or loss.`;
}

function findCrossOverDate(series, leftKey, rightKey) {
  for (let i = 1; i < series.length; i += 1) {
    const previousLeft = series[i - 1][leftKey];
    const previousRight = series[i - 1][rightKey];
    const currentLeft = series[i][leftKey];
    const currentRight = series[i][rightKey];
    if (currentLeft >= currentRight && previousLeft < previousRight) return series[i].date;
  }
  return "";
}

function buildWarnings(options) {
  const warnings = [];
  if (options.years < 0.25) warnings.push("This is a very short time window, so CAGR, volatility, and drawdown statistics can swing sharply.");
  if (options.growthRate !== undefined && options.growthRate > 0.6) warnings.push("The chosen Bitcoin growth rate is very high. Use conservative, base, and aggressive scenarios together before trusting the ending value.");
  if (options.growthRate !== undefined && options.growthRate < -0.35) warnings.push("The growth assumption is deeply negative, so the projection represents a stressed scenario rather than a normal path.");
  if (options.inflation > 0.08) warnings.push("High inflation can shrink real purchasing power even if the nominal Bitcoin value looks strong.");
  if (options.monthlyContribution > 0 && options.initialInvestment === 0 && options.mode !== "comparison") warnings.push("This plan relies entirely on recurring Bitcoin buying, so the result depends more on ongoing discipline than on one perfect entry date.");
  if (options.useHistorical === false && options.style === "volatile") warnings.push("Volatile mode introduces deterministic bull and bear swings around your long-term growth assumption. Treat it as a planning range, not a prediction.");
  if (options.volatility > 0.8) warnings.push("Very high volatility means the path is exceptionally unstable, even if the final value ends higher.");
  return warnings;
}

function validateRange(startDate, endDate) {
  if (!startDate || !endDate) return "Please choose both start and end dates.";
  const start = parseDate(startDate).getTime();
  const end = parseDate(endDate).getTime();
  if (end <= start) return "End date must be later than the start date.";
  return "";
}

function mergeHistoricalOrFutureSeries(priceSeries, btcSeries, benchmarkSeries, inflationRate) {
  return priceSeries.map((row, index) => ({
    date: row.date,
    years: row.years,
    btcPrice: row.price,
    monthlyReturn: row.monthlyReturn,
    value: btcSeries[index].value,
    lumpValue: btcSeries[index].lumpValue,
    dcaValue: btcSeries[index].dcaValue,
    units: btcSeries[index].units,
    lumpUnits: btcSeries[index].lumpUnits,
    totalInvested: btcSeries[index].totalInvested,
    profit: btcSeries[index].profit,
    lumpProfit: btcSeries[index].lumpProfit,
    benchmarkValue: benchmarkSeries[index].value,
    benchmarkProfit: benchmarkSeries[index].profit,
    benchmarkInvested: benchmarkSeries[index].totalInvested,
    realValue: btcSeries[index].value / Math.pow(1 + inflationRate, row.years)
  }));
}

function makeAnalyticsRows(base) {
  return [
    { metric: "Total invested", value: formatMoney(base.totalInvested), note: "The total capital committed across the selected time window." },
    { metric: "Bitcoin units held", value: formatBtcUnits(base.units), note: "Estimated BTC accumulated from the lump sum and any monthly BTC buying." },
    { metric: "Price move", value: formatPercentDecimal(base.priceMove), note: `Bitcoin reference price moved from ${formatMoney(base.startPrice)} to ${formatMoney(base.endPrice)}.` },
    { metric: "Annualized volatility", value: formatPercentDecimal(base.volatility), note: "Standard deviation of monthly Bitcoin returns annualized into a more familiar risk number." },
    { metric: "Max drawdown", value: formatPercentDecimal(base.maxDrawdown), note: "Largest peak-to-trough drop experienced by the Bitcoin plan over the selected path." },
    { metric: "Best year", value: `${base.bestYear.bestLabel} (${formatPercentDecimal(base.bestYear.bestReturn)})`, note: "Strongest annual Bitcoin move in the selected period." },
    { metric: "Worst year", value: `${base.worstYear.worstLabel} (${formatPercentDecimal(base.worstYear.worstReturn)})`, note: "Weakest annual Bitcoin move in the selected period." },
    { metric: "Real CAGR", value: formatPercentDecimal(base.realCagr), note: "Annualized growth after adjusting the ending value for inflation." },
    { metric: "Benchmark gap", value: `${formatMoney(base.benchmarkGap)} (${formatPercentDecimal(base.benchmarkGapPct)})`, note: "Difference between the Bitcoin plan and the comparison benchmark at the end date." },
    { metric: "Capital efficiency", value: `${base.capitalEfficiency.toFixed(2)}x`, note: "Return per unit of volatility. Higher values mean better reward for the risk taken." }
  ];
}
function makeHistoricalResult() {
  const investment = getNumeric("hist-investment");
  const monthlyContribution = getNumeric("hist-dca");
  const startDate = $("hist-start").value;
  const endDate = $("hist-end").value;
  const benchmarkRate = getNumeric("hist-stock-rate") / 100;
  const inflationRate = getNumeric("hist-inflation") / 100;
  const error = validateRange(startDate, endDate);
  if (error) return { error };
  if (investment <= 0 && monthlyContribution <= 0) return { error: "Enter an initial investment or a monthly Bitcoin DCA amount greater than zero." };
  if (startDate < firstHistoricalDate || endDate > lastHistoricalDate) return { error: `Historical mode supports dates between ${firstHistoricalDate} and ${lastHistoricalDate}.` };
  const years = yearsBetween(startDate, endDate);
  const priceSeries = buildHistoricalPriceSeries(startDate, endDate);
  const btcSeries = simulateBitcoinPlan(priceSeries, investment, monthlyContribution);
  const benchmarkSeries = simulateFixedReturnPlan(investment, monthlyContribution, benchmarkRate, priceSeries.map((row) => row.date));
  const series = mergeHistoricalOrFutureSeries(priceSeries, btcSeries, benchmarkSeries, inflationRate);
  const maxDrawdown = applyDrawdown(series, "value", "drawdown");
  applyDrawdown(series, "benchmarkValue", "benchmarkDrawdown");
  const snapshots = buildSnapshotsFromSeries(series, startDate, endDate, "value");
  const yearStats = computeYearReturnStats(snapshots, "btcPrice");
  const volatility = computeStandardDeviation(series.slice(1).map((row) => row.monthlyReturn)) * Math.sqrt(12);
  const finalRow = series[series.length - 1];
  const totalInvested = finalRow.totalInvested;
  const finalValue = finalRow.value;
  const profit = finalValue - totalInvested;
  const returnPct = safeDivide(profit, totalInvested);
  const cagr = years > 0 && totalInvested > 0 && finalValue > 0 ? Math.pow(finalValue / totalInvested, 1 / years) - 1 : 0;
  const realValue = finalValue / Math.pow(1 + inflationRate, years);
  const realCagr = (1 + cagr) / (1 + inflationRate) - 1;
  const benchmarkFinal = finalRow.benchmarkValue;
  const benchmarkGap = finalValue - benchmarkFinal;
  const benchmarkGapPct = safeDivide(benchmarkGap, benchmarkFinal);
  const capitalEfficiency = safeDivide(returnPct, Math.max(volatility, 0.05));
  const riskScore = computeRiskScore(volatility, maxDrawdown);
  const qualityScore = computeQualityScore(returnPct, benchmarkGapPct, capitalEfficiency, volatility, maxDrawdown);
  const strategyRows = [
    {
      name: monthlyContribution > 0 ? "Bitcoin lump sum only" : "Bitcoin plan",
      finalValue: finalRow.lumpValue,
      totalInvested: investment,
      returnPct: safeDivide(finalRow.lumpValue - investment, investment),
      insight: monthlyContribution > 0 ? "Shows what timing alone did without monthly BTC buying." : "One-time Bitcoin exposure only."
    },
    ...(monthlyContribution > 0 ? [{
      name: "Bitcoin lump sum + BTC DCA",
      finalValue,
      totalInvested,
      returnPct,
      insight: "Combines entry timing with recurring monthly accumulation."
    }] : []),
    {
      name: "Benchmark plan",
      finalValue: benchmarkFinal,
      totalInvested: finalRow.benchmarkInvested,
      returnPct: safeDivide(benchmarkFinal - finalRow.benchmarkInvested, finalRow.benchmarkInvested),
      insight: `${formatPercentValue(benchmarkRate * 100)} smoother annual benchmark using the same cash-flow pattern.`
    }
  ];
  return {
    mode: "historical",
    comparisonSource: "Historical",
    sourceLabel: "Historical Bitcoin reference path",
    startDate,
    endDate,
    years,
    investment,
    monthlyContribution,
    totalInvested,
    finalValue,
    profit,
    returnPct,
    cagr,
    multiple: totalInvested > 0 ? finalValue / totalInvested : 0,
    realValue,
    realCagr,
    benchmarkRate,
    benchmarkFinal,
    benchmarkGap,
    benchmarkGapPct,
    startPrice: series[0].btcPrice,
    endPrice: finalRow.btcPrice,
    priceMove: safeDivide(finalRow.btcPrice - series[0].btcPrice, series[0].btcPrice),
    units: finalRow.units,
    volatility,
    maxDrawdown,
    bestYear: { bestLabel: yearStats.bestLabel, bestReturn: yearStats.bestReturn },
    worstYear: { worstLabel: yearStats.worstLabel, worstReturn: yearStats.worstReturn },
    riskScore,
    qualityScore,
    capitalEfficiency,
    series,
    snapshots,
    warnings: buildWarnings({ mode: "historical", years, initialInvestment: investment, monthlyContribution, inflation: inflationRate, volatility }),
    analyticsRows: makeAnalyticsRows({
      totalInvested,
      units: finalRow.units,
      startPrice: series[0].btcPrice,
      endPrice: finalRow.btcPrice,
      priceMove: safeDivide(finalRow.btcPrice - series[0].btcPrice, series[0].btcPrice),
      volatility,
      maxDrawdown,
      bestYear: { bestLabel: yearStats.bestLabel, bestReturn: yearStats.bestReturn },
      worstYear: { worstLabel: yearStats.worstLabel, worstReturn: yearStats.worstReturn },
      realCagr,
      benchmarkGap,
      benchmarkGapPct,
      capitalEfficiency
    }),
    strategyRows,
    bestStrategy: strategyRows.reduce((acc, row) => (row.finalValue > acc.finalValue ? row : acc), strategyRows[0]),
    breakEvenDate: findCrossOverDate(series, "value", "benchmarkValue")
  };
}

function makeProjectedStrategy(priceSeries, initialInvestment, monthlyContribution, benchmarkRate, inflationRate) {
  const btcSeries = simulateBitcoinPlan(priceSeries, initialInvestment, monthlyContribution);
  const benchmarkSeries = simulateFixedReturnPlan(initialInvestment, monthlyContribution, benchmarkRate, priceSeries.map((row) => row.date));
  const series = mergeHistoricalOrFutureSeries(priceSeries, btcSeries, benchmarkSeries, inflationRate);
  applyDrawdown(series, "value", "drawdown");
  const finalRow = series[series.length - 1];
  const years = yearsBetween(series[0].date, finalRow.date);
  return {
    series,
    finalValue: finalRow.value,
    totalInvested: finalRow.totalInvested,
    returnPct: safeDivide(finalRow.value - finalRow.totalInvested, finalRow.totalInvested),
    cagr: years > 0 && finalRow.totalInvested > 0 && finalRow.value > 0 ? Math.pow(finalRow.value / finalRow.totalInvested, 1 / years) - 1 : 0
  };
}

function makeFutureResult() {
  const investment = getNumeric("fut-investment");
  const monthlyContribution = getNumeric("fut-dca");
  const startDate = $("fut-start").value;
  const endDate = $("fut-end").value;
  const growthRate = getNumeric("fut-growth-rate") / 100;
  const benchmarkRate = getNumeric("fut-stock-rate") / 100;
  const inflationRate = getNumeric("fut-inflation") / 100;
  const style = $("fut-model-style").value;
  const error = validateRange(startDate, endDate);
  if (error) return { error };
  if (investment <= 0 && monthlyContribution <= 0) return { error: "Enter an initial investment or a monthly Bitcoin DCA amount greater than zero." };
  if (growthRate <= -1) return { error: "Expected annual growth rate must be greater than -100%." };
  const years = yearsBetween(startDate, endDate);
  const anchorDate = startDate <= lastHistoricalDate ? startDate : lastHistoricalDate;
  const startPrice = getHistoricalPrice(anchorDate);
  const priceSeries = buildProjectedPriceSeries(startDate, endDate, startPrice, growthRate, style, "base");
  const btcSeries = simulateBitcoinPlan(priceSeries, investment, monthlyContribution);
  const benchmarkSeries = simulateFixedReturnPlan(investment, monthlyContribution, benchmarkRate, priceSeries.map((row) => row.date));
  const series = mergeHistoricalOrFutureSeries(priceSeries, btcSeries, benchmarkSeries, inflationRate);
  const maxDrawdown = applyDrawdown(series, "value", "drawdown");
  applyDrawdown(series, "benchmarkValue", "benchmarkDrawdown");
  const snapshots = buildSnapshotsFromSeries(series, startDate, endDate, "value");
  const yearStats = computeYearReturnStats(snapshots, "btcPrice");
  const volatility = computeStandardDeviation(series.slice(1).map((row) => row.monthlyReturn)) * Math.sqrt(12);
  const finalRow = series[series.length - 1];
  const totalInvested = finalRow.totalInvested;
  const finalValue = finalRow.value;
  const profit = finalValue - totalInvested;
  const returnPct = safeDivide(profit, totalInvested);
  const cagr = years > 0 && totalInvested > 0 && finalValue > 0 ? Math.pow(finalValue / totalInvested, 1 / years) - 1 : 0;
  const realValue = finalValue / Math.pow(1 + inflationRate, years);
  const realCagr = (1 + cagr) / (1 + inflationRate) - 1;
  const benchmarkFinal = finalRow.benchmarkValue;
  const benchmarkGap = finalValue - benchmarkFinal;
  const benchmarkGapPct = safeDivide(benchmarkGap, benchmarkFinal);
  const capitalEfficiency = safeDivide(returnPct, Math.max(volatility, 0.05));
  const riskScore = computeRiskScore(volatility, maxDrawdown);
  const qualityScore = computeQualityScore(returnPct, benchmarkGapPct, capitalEfficiency, volatility, maxDrawdown);
  const conservativeRate = growthRate * 0.6;
  const aggressiveRate = growthRate * 1.35;
  const conservative = makeProjectedStrategy(buildProjectedPriceSeries(startDate, endDate, startPrice, conservativeRate, style, "conservative"), investment, monthlyContribution, benchmarkRate, inflationRate);
  const aggressive = makeProjectedStrategy(buildProjectedPriceSeries(startDate, endDate, startPrice, aggressiveRate, style, "aggressive"), investment, monthlyContribution, benchmarkRate, inflationRate);
  const strategyRows = [
    { name: "Conservative BTC scenario", finalValue: conservative.finalValue, totalInvested: conservative.totalInvested, returnPct: conservative.returnPct, insight: `${formatPercentValue(conservativeRate * 100)} annual growth assumption using the same projection style.` },
    { name: "Base BTC scenario", finalValue, totalInvested, returnPct, insight: `${formatPercentValue(growthRate * 100)} annual growth assumption with ${style} modeling.` },
    { name: "Aggressive BTC scenario", finalValue: aggressive.finalValue, totalInvested: aggressive.totalInvested, returnPct: aggressive.returnPct, insight: `${formatPercentValue(aggressiveRate * 100)} annual growth assumption using the same path style.` },
    { name: "Benchmark plan", finalValue: benchmarkFinal, totalInvested: finalRow.benchmarkInvested, returnPct: safeDivide(benchmarkFinal - finalRow.benchmarkInvested, finalRow.benchmarkInvested), insight: `${formatPercentValue(benchmarkRate * 100)} smoother benchmark using the same contribution pattern.` }
  ];
  return {
    mode: "future",
    comparisonSource: "Projected",
    sourceLabel: "Projected Bitcoin path",
    startDate,
    endDate,
    years,
    investment,
    monthlyContribution,
    totalInvested,
    finalValue,
    profit,
    returnPct,
    cagr,
    multiple: totalInvested > 0 ? finalValue / totalInvested : 0,
    realValue,
    realCagr,
    benchmarkRate,
    benchmarkFinal,
    benchmarkGap,
    benchmarkGapPct,
    startPrice,
    endPrice: finalRow.btcPrice,
    priceMove: safeDivide(finalRow.btcPrice - startPrice, startPrice),
    units: finalRow.units,
    volatility,
    maxDrawdown,
    bestYear: { bestLabel: yearStats.bestLabel, bestReturn: yearStats.bestReturn },
    worstYear: { worstLabel: yearStats.worstLabel, worstReturn: yearStats.worstReturn },
    riskScore,
    qualityScore,
    capitalEfficiency,
    series,
    snapshots,
    warnings: buildWarnings({ mode: "future", years, initialInvestment: investment, monthlyContribution, inflation: inflationRate, growthRate, style, volatility, useHistorical: false }),
    strategyRows,
    bestStrategy: strategyRows.reduce((acc, row) => (row.finalValue > acc.finalValue ? row : acc), strategyRows[0]),
    breakEvenDate: findCrossOverDate(series, "value", "benchmarkValue"),
    scenarioSeries: { conservative: conservative.series, base: series, aggressive: aggressive.series },
    analyticsRows: makeAnalyticsRows({
      totalInvested,
      units: finalRow.units,
      startPrice,
      endPrice: finalRow.btcPrice,
      priceMove: safeDivide(finalRow.btcPrice - startPrice, startPrice),
      volatility,
      maxDrawdown,
      bestYear: { bestLabel: yearStats.bestLabel, bestReturn: yearStats.bestReturn },
      worstYear: { worstLabel: yearStats.worstLabel, worstReturn: yearStats.worstReturn },
      realCagr,
      benchmarkGap,
      benchmarkGapPct,
      capitalEfficiency
    })
  };
}
function makeComparisonResult() {
  const investment = getNumeric("cmp-investment");
  const monthlyContribution = getNumeric("cmp-sip");
  const startDate = $("cmp-start").value;
  const endDate = $("cmp-end").value;
  const fixedRate = getNumeric("cmp-fixed-rate") / 100;
  const bitcoinRate = getNumeric("cmp-bitcoin-rate") / 100;
  const inflationRate = getNumeric("cmp-inflation") / 100;
  const source = $("cmp-source").value;
  const style = $("cmp-model-style").value;
  const error = validateRange(startDate, endDate);
  if (error) return { error };
  if (investment <= 0 && monthlyContribution <= 0) return { error: "Enter a lump sum, a monthly DCA amount, or both." };
  if (bitcoinRate <= -1) return { error: "Projected Bitcoin growth rate must be greater than -100%." };
  const endIsHistorical = endDate <= lastHistoricalDate;
  const useHistorical = source === "historical" || (source === "auto" && endIsHistorical);
  if (source === "historical" && (startDate < firstHistoricalDate || endDate > lastHistoricalDate)) {
    return { error: `Historical comparison requires dates between ${firstHistoricalDate} and ${lastHistoricalDate}.` };
  }
  const startPrice = getHistoricalPrice(startDate <= lastHistoricalDate ? startDate : lastHistoricalDate);
  const priceSeries = useHistorical ? buildHistoricalPriceSeries(startDate, endDate) : buildProjectedPriceSeries(startDate, endDate, startPrice, bitcoinRate, style, "comparison");
  const btcLumpSeries = simulateBitcoinPlan(priceSeries, investment, 0);
  const btcDcaSeries = simulateBitcoinPlan(priceSeries, 0, monthlyContribution);
  const fixedLumpSeries = simulateFixedReturnPlan(investment, 0, fixedRate, priceSeries.map((row) => row.date));
  const fixedSipSeries = simulateFixedReturnPlan(0, monthlyContribution, fixedRate, priceSeries.map((row) => row.date));
  const series = priceSeries.map((row, index) => ({
    date: row.date,
    years: row.years,
    btcPrice: row.price,
    monthlyReturn: row.monthlyReturn,
    btcLumpValue: btcLumpSeries[index].value,
    btcLumpProfit: btcLumpSeries[index].profit,
    btcLumpInvested: btcLumpSeries[index].totalInvested,
    btcUnits: btcLumpSeries[index].units,
    btcDcaValue: btcDcaSeries[index].value,
    btcDcaProfit: btcDcaSeries[index].profit,
    btcDcaInvested: btcDcaSeries[index].totalInvested,
    fixedLumpValue: fixedLumpSeries[index].value,
    fixedLumpProfit: fixedLumpSeries[index].profit,
    fixedLumpInvested: fixedLumpSeries[index].totalInvested,
    fixedSipValue: fixedSipSeries[index].value,
    fixedSipProfit: fixedSipSeries[index].profit,
    fixedSipInvested: fixedSipSeries[index].totalInvested
  }));
  const maxDrawdown = applyDrawdown(series, "btcLumpValue", "drawdown");
  applyDrawdown(series, "fixedLumpValue", "benchmarkDrawdown");
  const snapshots = buildSnapshotsFromSeries(series, startDate, endDate, "btcLumpValue");
  const yearStats = computeYearReturnStats(snapshots, "btcPrice");
  const volatility = computeStandardDeviation(series.slice(1).map((row) => row.monthlyReturn)) * Math.sqrt(12);
  const finalRow = series[series.length - 1];
  const years = yearsBetween(startDate, endDate);
  const finalValue = finalRow.btcLumpValue;
  const profit = finalRow.btcLumpProfit;
  const returnPct = safeDivide(profit, finalRow.btcLumpInvested);
  const cagr = years > 0 && finalRow.btcLumpInvested > 0 && finalValue > 0 ? Math.pow(finalValue / finalRow.btcLumpInvested, 1 / years) - 1 : 0;
  const realValue = finalValue / Math.pow(1 + inflationRate, years);
  const realCagr = (1 + cagr) / (1 + inflationRate) - 1;
  const benchmarkGap = finalValue - finalRow.fixedLumpValue;
  const benchmarkGapPct = safeDivide(benchmarkGap, finalRow.fixedLumpValue);
  const capitalEfficiency = safeDivide(returnPct, Math.max(volatility, 0.05));
  const riskScore = computeRiskScore(volatility, maxDrawdown);
  const qualityScore = computeQualityScore(returnPct, benchmarkGapPct, capitalEfficiency, volatility, maxDrawdown);
  const strategyRows = [
    { name: "Bitcoin lump sum", finalValue: finalRow.btcLumpValue, totalInvested: finalRow.btcLumpInvested, returnPct: safeDivide(finalRow.btcLumpProfit, finalRow.btcLumpInvested), insight: "Best for investors who want full exposure from the first day." },
    { name: "Bitcoin DCA", finalValue: finalRow.btcDcaValue, totalInvested: finalRow.btcDcaInvested, returnPct: safeDivide(finalRow.btcDcaProfit, finalRow.btcDcaInvested), insight: "Spreads entry risk by buying Bitcoin monthly." },
    { name: "Fixed-return lump sum", finalValue: finalRow.fixedLumpValue, totalInvested: finalRow.fixedLumpInvested, returnPct: safeDivide(finalRow.fixedLumpProfit, finalRow.fixedLumpInvested), insight: `${formatPercentValue(fixedRate * 100)} smoother benchmark with one-time capital.` },
    { name: "Fixed-return SIP", finalValue: finalRow.fixedSipValue, totalInvested: finalRow.fixedSipInvested, returnPct: safeDivide(finalRow.fixedSipProfit, finalRow.fixedSipInvested), insight: `${formatPercentValue(fixedRate * 100)} benchmark using steady monthly investing.` }
  ];
  const breakEvenDate = findCrossOverDate(series, "btcLumpValue", "fixedLumpValue");
  const dcaBreakEvenDate = findCrossOverDate(series, "btcDcaValue", "fixedSipValue");
  return {
    mode: "comparison",
    comparisonSource: useHistorical ? "Historical" : "Projected",
    sourceLabel: useHistorical ? "Historical BTC comparison path" : "Projected BTC comparison path",
    startDate,
    endDate,
    years,
    investment,
    monthlyContribution,
    totalInvested: finalRow.btcLumpInvested,
    finalValue,
    profit,
    returnPct,
    cagr,
    multiple: finalRow.btcLumpInvested > 0 ? finalValue / finalRow.btcLumpInvested : 0,
    realValue,
    realCagr,
    benchmarkRate: fixedRate,
    benchmarkFinal: finalRow.fixedLumpValue,
    benchmarkGap,
    benchmarkGapPct,
    startPrice: priceSeries[0].price,
    endPrice: finalRow.btcPrice,
    priceMove: safeDivide(finalRow.btcPrice - priceSeries[0].price, priceSeries[0].price),
    units: finalRow.btcUnits,
    volatility,
    maxDrawdown,
    bestYear: { bestLabel: yearStats.bestLabel, bestReturn: yearStats.bestReturn },
    worstYear: { worstLabel: yearStats.worstLabel, worstReturn: yearStats.worstReturn },
    riskScore,
    qualityScore,
    capitalEfficiency,
    series,
    snapshots,
    warnings: buildWarnings({ mode: "comparison", years, initialInvestment: investment, monthlyContribution, inflation: inflationRate, growthRate: useHistorical ? undefined : bitcoinRate, style, volatility, useHistorical }),
    strategyRows,
    bestStrategy: strategyRows.reduce((acc, row) => (row.finalValue > acc.finalValue ? row : acc), strategyRows[0]),
    bestEfficiency: strategyRows.reduce((acc, row) => (row.returnPct > acc.returnPct ? row : acc), strategyRows[0]),
    breakEvenDate,
    dcaBreakEvenDate,
    analyticsRows: [
      { metric: "Bitcoin annualized volatility", value: formatPercentDecimal(volatility), note: "Helps explain why Bitcoin can outperform and still feel uncomfortable to hold." },
      { metric: "Bitcoin max drawdown", value: formatPercentDecimal(maxDrawdown), note: "Largest BTC lump-sum drop relative to its previous peak." },
      { metric: "Best year", value: `${yearStats.bestLabel} (${formatPercentDecimal(yearStats.bestReturn)})`, note: "Strongest year in the BTC price path used for this comparison." },
      { metric: "Worst year", value: `${yearStats.worstLabel} (${formatPercentDecimal(yearStats.worstReturn)})`, note: "Weakest year in the BTC price path used for this comparison." },
      { metric: "BTC vs fixed lump-sum gap", value: `${formatMoney(benchmarkGap)} (${formatPercentDecimal(benchmarkGapPct)})`, note: "Opportunity gain or missed gain relative to the smoother one-time benchmark." },
      { metric: "BTC vs fixed SIP gap", value: `${formatMoney(finalRow.btcDcaValue - finalRow.fixedSipValue)} (${formatPercentDecimal(safeDivide(finalRow.btcDcaValue - finalRow.fixedSipValue, finalRow.fixedSipValue))})`, note: "Shows whether monthly Bitcoin buying beat the same recurring benchmark cash flow." },
      { metric: "Real BTC lump-sum value", value: formatMoney(realValue), note: "Purchasing-power-adjusted ending value after inflation." },
      { metric: "Capital efficiency", value: `${capitalEfficiency.toFixed(2)}x`, note: "Reward per unit of volatility using the BTC lump-sum path." },
      { metric: "BTC beat fixed lump sum by", value: breakEvenDate ? formatDateLabel(breakEvenDate) : "No crossover", note: "First monthly checkpoint where BTC lump sum moved ahead of the fixed-return lump-sum path." },
      { metric: "BTC DCA beat fixed SIP by", value: dcaBreakEvenDate ? formatDateLabel(dcaBreakEvenDate) : "No crossover", note: "First monthly checkpoint where recurring Bitcoin buying moved ahead of the same recurring benchmark path." }
    ]
  };
}

function setStatus(text, type = "") {
  const banner = $("status-banner");
  banner.className = "status-banner" + (type ? ` ${type}` : "");
  banner.textContent = text;
}

function setInsight(text) { $("insight-box").textContent = text; }
function setModePill(text) { $("current-mode-pill").textContent = text; }
function setFormula(text) { $("mode-formula").innerHTML = text; }

function resetCardThemes() {
  for (let i = 1; i <= 8; i += 1) {
    const card = $(`card-${i}`);
    if (!card) continue;
    card.className = `result-card ${resultCardThemes[i - 1]}${i === 1 || i === 2 || i === 4 ? " featured" : ""}`;
  }
}

function setCard(index, label, value, note, tone = "") {
  $(`out-label-${index}`).textContent = label;
  $(`out-label-${index}`).title = note;
  $(`out-value-${index}`).textContent = value;
  $(`out-note-${index}`).textContent = note;
  const card = $(`card-${index}`);
  if (card) {
    card.classList.remove("positive", "negative");
    if (tone) card.classList.add(tone);
  }
}

function setWarnings(warnings) {
  const box = $("warning-box");
  const list = $("warning-list");
  if (!warnings.length) {
    box.classList.add("hidden");
    list.innerHTML = "";
    return;
  }
  box.classList.remove("hidden");
  list.innerHTML = warnings.map((warning) => `<div class="warning-item">${warning}</div>`).join("");
}

function setMetricBadge(id, text, extraClass = "") {
  const node = $(id);
  node.className = `metric-badge${extraClass ? ` ${extraClass}` : ""}`;
  node.textContent = text;
}

function renderAnalyticsTable(rows) {
  $("analytics-body").innerHTML = rows.map((row) => `<tr><td>${row.metric}</td><td>${row.value}</td><td>${row.note}</td></tr>`).join("");
}

function renderStrategyTable(result) {
  $("strategy-body").innerHTML = result.strategyRows.map((row) => {
    const highlight = row.name === result.bestStrategy.name ? "compare-a-cell" : "";
    return `<tr><td class="${highlight}">${row.name}</td><td class="${highlight}">${formatMoney(row.finalValue)}</td><td>${formatMoney(row.totalInvested)}</td><td>${formatPercentDecimal(row.returnPct)}</td><td>${row.insight}</td></tr>`;
  }).join("");
  if (result.mode === "comparison") {
    $("strategy-title").textContent = "Strategy Snapshot";
    $("strategy-context").textContent = "Compare Bitcoin lump sum, Bitcoin DCA, fixed lump sum, and fixed SIP paths over the same dates.";
    setMetricBadge("strategy-badge", `Best ending value: ${result.bestStrategy.name}`, result.bestStrategy.name.toLowerCase().includes("fixed") ? "warning" : "sky");
  } else if (result.mode === "future") {
    $("strategy-title").textContent = "Scenario Snapshot";
    $("strategy-context").textContent = "Conservative, base, and aggressive Bitcoin scenarios help you see how much the outcome depends on the return assumption.";
    setMetricBadge("strategy-badge", `Best scenario: ${result.bestStrategy.name}`, result.bestStrategy.name.toLowerCase().includes("aggressive") ? "sky" : "");
  } else {
    $("strategy-title").textContent = "Strategy Snapshot";
    $("strategy-context").textContent = "See how timing-only Bitcoin, Bitcoin with monthly DCA, and the benchmark path compare over the same historical window.";
    setMetricBadge("strategy-badge", `Best ending value: ${result.bestStrategy.name}`, result.bestStrategy.name.toLowerCase().includes("benchmark") ? "warning" : "");
  }
}

function renderProjection(headers, rows, context, filename) {
  $("projection-head-row").innerHTML = headers.map((header) => `<th>${header}</th>`).join("");
  $("projection-body").innerHTML = rows.map((row) => `<tr>${headers.map((header) => `<td>${row[header]}</td>`).join("")}</tr>`).join("");
  $("projection-context").textContent = context;
  state.csvRows = rows;
  state.csvFilename = filename;
}

function destroyChart(name) {
  if (state.charts[name]) {
    state.charts[name].destroy();
    state.charts[name] = null;
  }
}

function clearCanvas(id) {
  const canvas = $(id);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function queueCalculate() {
  window.clearTimeout(state.calculateTimer);
  state.calculateTimer = window.setTimeout(() => calculateBitcoin(false), 180);
}

function makeChartOptions(useCurrencyTicks = true) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 700, easing: "easeOutQuart" },
    interaction: { mode: "index", intersect: false },
    plugins: { legend: { position: "bottom" } },
    scales: {
      y: {
        ticks: {
          callback: (value) => useCurrencyTicks ? formatMoney(value, 0) : `${Number(value).toFixed(0)}%`
        }
      }
    }
  };
}
function renderCharts(result) {
  if (typeof Chart === "undefined") return;
  const labels = result.series.map((row) => formatDateLabel(row.date));
  ["growth", "profit", "comparison", "drawdown"].forEach(destroyChart);
  ["growth-chart", "profit-chart", "comparison-chart", "drawdown-chart"].forEach(clearCanvas);

  const growthDatasets = result.mode === "comparison"
    ? [
      { label: "BTC Lump Sum", data: result.series.map((row) => row.btcLumpValue), yAxisID: "yValue", borderColor: "#0d9488", backgroundColor: "rgba(13, 148, 136, 0.12)", borderWidth: 3, tension: 0.25 },
      { label: "BTC DCA", data: result.series.map((row) => row.btcDcaValue), yAxisID: "yValue", borderColor: "#f59e0b", backgroundColor: "rgba(245, 158, 11, 0.12)", borderWidth: 2, tension: 0.25 },
      { label: "Bitcoin Price", data: result.series.map((row) => row.btcPrice), yAxisID: "yPrice", borderColor: "#0284c7", backgroundColor: "rgba(2, 132, 199, 0.12)", borderWidth: 2, tension: 0.25 }
    ]
    : [
      { label: "Bitcoin Plan Value", data: result.series.map((row) => row.value), yAxisID: "yValue", borderColor: "#0d9488", backgroundColor: "rgba(13, 148, 136, 0.12)", borderWidth: 3, tension: 0.25 },
      { label: "Bitcoin Price", data: result.series.map((row) => row.btcPrice), yAxisID: "yPrice", borderColor: "#0284c7", backgroundColor: "rgba(2, 132, 199, 0.12)", borderWidth: 2, tension: 0.25 }
    ];

  state.charts.growth = new Chart($("growth-chart"), {
    type: "line",
    data: { labels, datasets: growthDatasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 700, easing: "easeOutQuart" },
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { position: "bottom" } },
      scales: {
        yValue: { position: "left", ticks: { callback: (value) => formatMoney(value, 0) } },
        yPrice: { position: "right", grid: { drawOnChartArea: false }, ticks: { callback: (value) => formatMoney(value, 0) } }
      }
    }
  });

  const profitDatasets = result.mode === "comparison"
    ? [
      { label: "BTC Lump-Sum Profit", data: result.series.map((row) => row.btcLumpProfit), borderColor: "#0d9488", backgroundColor: "rgba(13, 148, 136, 0.14)", borderWidth: 3, tension: 0.25 },
      { label: "BTC DCA Profit", data: result.series.map((row) => row.btcDcaProfit), borderColor: "#f59e0b", backgroundColor: "rgba(245, 158, 11, 0.14)", borderWidth: 2, tension: 0.25 },
      { label: "Fixed Lump Profit", data: result.series.map((row) => row.fixedLumpProfit), borderColor: "#0284c7", backgroundColor: "rgba(2, 132, 199, 0.14)", borderWidth: 2, tension: 0.25 },
      { label: "Fixed SIP Profit", data: result.series.map((row) => row.fixedSipProfit), borderColor: "#f43f5e", backgroundColor: "rgba(244, 63, 94, 0.14)", borderWidth: 2, tension: 0.25 }
    ]
    : [
      { label: "Bitcoin Plan Profit", data: result.series.map((row) => row.profit), borderColor: "#0d9488", backgroundColor: "rgba(13, 148, 136, 0.14)", borderWidth: 3, tension: 0.25 },
      { label: "Benchmark Profit", data: result.series.map((row) => row.benchmarkProfit), borderColor: "#0284c7", backgroundColor: "rgba(2, 132, 199, 0.14)", borderWidth: 2, tension: 0.25 }
    ];

  state.charts.profit = new Chart($("profit-chart"), {
    type: "line",
    data: { labels, datasets: profitDatasets },
    options: makeChartOptions(true)
  });

  let comparisonDatasets;
  if (result.mode === "future") {
    comparisonDatasets = [
      { label: "Conservative BTC", data: result.scenarioSeries.conservative.map((row) => row.value), borderColor: "#0284c7", backgroundColor: "rgba(2, 132, 199, 0.12)", borderWidth: 2, tension: 0.25 },
      { label: "Base BTC", data: result.scenarioSeries.base.map((row) => row.value), borderColor: "#0d9488", backgroundColor: "rgba(13, 148, 136, 0.12)", borderWidth: 3, tension: 0.25 },
      { label: "Aggressive BTC", data: result.scenarioSeries.aggressive.map((row) => row.value), borderColor: "#f59e0b", backgroundColor: "rgba(245, 158, 11, 0.12)", borderWidth: 2, tension: 0.25 },
      { label: "Benchmark", data: result.series.map((row) => row.benchmarkValue), borderColor: "#f43f5e", backgroundColor: "rgba(244, 63, 94, 0.12)", borderWidth: 2, tension: 0.25 }
    ];
  } else if (result.mode === "comparison") {
    comparisonDatasets = [
      { label: "BTC Lump Sum", data: result.series.map((row) => row.btcLumpValue), borderColor: "#0d9488", backgroundColor: "rgba(13, 148, 136, 0.12)", borderWidth: 3, tension: 0.25 },
      { label: "BTC DCA", data: result.series.map((row) => row.btcDcaValue), borderColor: "#f59e0b", backgroundColor: "rgba(245, 158, 11, 0.12)", borderWidth: 2, tension: 0.25 },
      { label: "Fixed Lump Sum", data: result.series.map((row) => row.fixedLumpValue), borderColor: "#0284c7", backgroundColor: "rgba(2, 132, 199, 0.12)", borderWidth: 2, tension: 0.25 },
      { label: "Fixed SIP", data: result.series.map((row) => row.fixedSipValue), borderColor: "#f43f5e", backgroundColor: "rgba(244, 63, 94, 0.12)", borderWidth: 2, tension: 0.25 }
    ];
  } else {
    comparisonDatasets = [
      { label: "Bitcoin Plan", data: result.series.map((row) => row.value), borderColor: "#0d9488", backgroundColor: "rgba(13, 148, 136, 0.12)", borderWidth: 3, tension: 0.25 },
      { label: "Lump Sum Only", data: result.series.map((row) => row.lumpValue), borderColor: "#f59e0b", backgroundColor: "rgba(245, 158, 11, 0.12)", borderWidth: 2, tension: 0.25 },
      { label: "Benchmark", data: result.series.map((row) => row.benchmarkValue), borderColor: "#0284c7", backgroundColor: "rgba(2, 132, 199, 0.12)", borderWidth: 2, tension: 0.25 }
    ];
  }

  state.charts.comparison = new Chart($("comparison-chart"), {
    type: "line",
    data: { labels, datasets: comparisonDatasets },
    options: makeChartOptions(true)
  });

  const drawdownDatasets = result.mode === "comparison"
    ? [
      { label: "BTC Lump-Sum Drawdown", data: result.series.map((row) => (row.drawdown || 0) * 100), borderColor: "#0d9488", backgroundColor: "rgba(13, 148, 136, 0.12)", borderWidth: 3, tension: 0.25 },
      { label: "Fixed Lump Drawdown", data: result.series.map((row) => (row.benchmarkDrawdown || 0) * 100), borderColor: "#0284c7", backgroundColor: "rgba(2, 132, 199, 0.12)", borderWidth: 2, tension: 0.25 }
    ]
    : [
      { label: "Bitcoin Plan Drawdown", data: result.series.map((row) => (row.drawdown || 0) * 100), borderColor: "#0d9488", backgroundColor: "rgba(13, 148, 136, 0.12)", borderWidth: 3, tension: 0.25 },
      { label: "Benchmark Drawdown", data: result.series.map((row) => (row.benchmarkDrawdown || 0) * 100), borderColor: "#0284c7", backgroundColor: "rgba(2, 132, 199, 0.12)", borderWidth: 2, tension: 0.25 }
    ];

  state.charts.drawdown = new Chart($("drawdown-chart"), {
    type: "line",
    data: { labels, datasets: drawdownDatasets },
    options: makeChartOptions(false)
  });
}

function renderErrorState(message) {
  resetCardThemes();
  for (let i = 1; i <= 8; i += 1) setCard(i, i === 1 ? "Waiting for valid inputs" : "Metric unavailable", i === 1 ? "--" : "0", "Correct the highlighted assumptions to generate a new Bitcoin analysis.");
  setWarnings([]);
  renderAnalyticsTable([]);
  $("strategy-body").innerHTML = "";
  $("projection-body").innerHTML = "";
  $("projection-context").textContent = "Enter a valid date range and assumption set to generate a detailed projection table.";
  ["growth", "profit", "comparison", "drawdown"].forEach(destroyChart);
  setStatus(message, "error");
  setInsight("Please correct the assumptions so the calculator can generate a valid Bitcoin growth path.");
}

function makeResultCards(result) {
  if (result.mode === "comparison") {
    return [
      ["Best Ending Strategy", `${result.bestStrategy.name} · ${formatMoney(result.bestStrategy.finalValue)}`, "Strategy with the highest ending value across the active comparison set."],
      ["Bitcoin Lump-Sum Value", formatMoney(result.finalValue), "Ending value of the one-time Bitcoin investment path."],
      ["Bitcoin DCA Value", formatMoney(result.series[result.series.length - 1].btcDcaValue), "Ending value of recurring monthly Bitcoin buying."],
      ["Fixed Lump-Sum Value", formatMoney(result.benchmarkFinal), "Ending value of the one-time fixed-return benchmark."],
      ["Fixed SIP Value", formatMoney(result.series[result.series.length - 1].fixedSipValue), "Ending value of recurring monthly contributions invested at the benchmark rate."],
      ["Best Efficiency", `${result.bestEfficiency.name} · ${formatPercentDecimal(result.bestEfficiency.returnPct)}`, "Highest return percentage relative to the capital actually invested in that strategy."],
      ["BTC vs Fixed Gap", formatMoney(result.benchmarkGap), "Difference between Bitcoin lump sum and the fixed-return lump-sum path."],
      ["Risk Snapshot", `${result.riskScore} / 100 · ${formatPercentDecimal(result.maxDrawdown)}`, "Combines Bitcoin volatility and drawdown into a quick path-risk signal."]
    ];
  }
  return [
    ["Final Investment Value", formatMoney(result.finalValue), "Ending value of the Bitcoin plan after any monthly BTC buying."],
    [result.profit >= 0 ? "Total Profit" : "Total Loss", formatMoney(result.profit), "Absolute change between total invested capital and the final Bitcoin value."],
    ["Total Return %", formatPercentDecimal(result.returnPct), buildReturnPercentNote(result)],
    [result.monthlyContribution > 0 ? "Equivalent CAGR" : "CAGR", formatPercentDecimal(result.cagr), "Annualized growth rate based on the ending value relative to total invested capital."],
    ["Growth Multiple", formatMultiple(result.multiple), "How many times larger the total invested capital became."],
    ["Inflation-Adjusted Value", formatMoney(result.realValue), "Estimated purchasing power after adjusting the ending value for inflation."],
    ["Risk Score", `${result.riskScore} / 100`, "Higher scores mean a more volatile and drawdown-heavy path."],
    ["Investment Quality Score", `${result.qualityScore} / 100 · ${scoreLabel(result.qualityScore)}`, "Combines reward, benchmark gap, and risk efficiency into a single quick score."]
  ];
}
function renderResult(result) {
  setModePill(state.activeMode === "historical" ? "Historical Mode" : state.activeMode === "future" ? "Future Projection" : "Comparison Mode");
  if (result.error) {
    renderErrorState(result.error);
    return;
  }
  resetCardThemes();
  const cards = makeResultCards(result);
  cards.forEach((card, index) => setCard(index + 1, card[0], card[1], card[2]));
  setWarnings(result.warnings);
  renderAnalyticsTable(result.analyticsRows);
  renderStrategyTable(result);

  if (result.mode === "historical") {
    setStatus(`${formatMoney(result.totalInvested)} turned into ${formatMoney(result.finalValue)} across ${result.years.toFixed(2)} years using the richer embedded Bitcoin history.`, result.profit >= 0 ? "success" : "warning");
    setInsight(`Historical mode estimates that Bitcoin moved from ${formatMoney(result.startPrice)} to ${formatMoney(result.endPrice)}. The plan accumulated ${formatBtcUnits(result.units)}, faced a max drawdown of ${formatPercentDecimal(result.maxDrawdown)}, and ${result.benchmarkGap >= 0 ? "finished ahead of" : "finished behind"} the ${formatPercentValue(result.benchmarkRate * 100)} benchmark by ${formatMoney(result.benchmarkGap)}.`);
    setFormula(`Historical mode values a lump sum as <strong>Units = Investment / Starting Bitcoin Price</strong>. Optional monthly BTC buying adds <strong>New Units = Monthly Amount / Bitcoin Price</strong> each month. The ending value is <strong>Total Units &times; Ending Bitcoin Price</strong>, and real value is <strong>Nominal Value / (1 + Inflation)<sup>n</sup></strong>.`);
  } else if (result.mode === "future") {
    setStatus(`${formatMoney(result.totalInvested)} is projected to become ${formatMoney(result.finalValue)} across ${result.years.toFixed(2)} years using the ${$("fut-model-style").value} projection style.`, result.profit >= 0 ? "success" : "warning");
    setInsight(`Future mode uses a ${$("fut-model-style").value} Bitcoin path around ${formatPercentValue(getNumeric("fut-growth-rate"))} annual growth. That produces an ending Bitcoin reference price of ${formatMoney(result.endPrice)}, a real value of ${formatMoney(result.realValue)}, and a benchmark gap of ${formatMoney(result.benchmarkGap)} against the ${formatPercentValue(result.benchmarkRate * 100)} comparison path.`);
    setFormula(`Future mode starts with <strong>FV = PV &times; (1 + r)<sup>n</sup></strong> as the base trend, then applies smoother, cycle-aware, or more volatile monthly path shaping. Optional monthly BTC buying accumulates extra units over time, and inflation is handled with <strong>Real Value = Nominal Value / (1 + i)<sup>n</sup></strong>.`);
  } else {
    setStatus(`Comparison mode shows ${result.bestStrategy.name} ending highest at ${formatMoney(result.bestStrategy.finalValue)}. Bitcoin lump sum ended at ${formatMoney(result.finalValue)}, while fixed lump sum ended at ${formatMoney(result.benchmarkFinal)}.`, result.benchmarkGap >= 0 ? "success" : "warning");
    setInsight(`${result.comparisonSource} comparison mode shows both timing and discipline. Bitcoin lump sum ${result.benchmarkGap >= 0 ? "finished ahead of" : "finished behind"} the fixed lump-sum benchmark by ${formatMoney(result.benchmarkGap)}. ${result.breakEvenDate ? `BTC first moved ahead of the fixed lump-sum path around ${formatDateLabel(result.breakEvenDate)}.` : "BTC never moved ahead of the fixed lump-sum path in the selected window."}`);
    setFormula(`Comparison mode places four paths on the same timeline: Bitcoin lump sum, Bitcoin DCA, fixed-return lump sum, and fixed-return SIP. Fixed-return paths compound with <strong>FV = PV &times; (1 + r)<sup>n</sup></strong> and standard monthly contribution growth, while Bitcoin paths reprice each unit using either the embedded history or the projected Bitcoin path.`);
  }

  if (result.mode === "comparison") {
    const headers = ["Year", "Snapshot Date", "Bitcoin Price", "BTC Lump Sum", "BTC DCA", "Fixed Lump Sum", "Fixed SIP", "Best Strategy"];
    const rows = result.snapshots.map((row) => {
      const options = [
        { name: "BTC Lump", value: row.btcLumpValue },
        { name: "BTC DCA", value: row.btcDcaValue },
        { name: "Fixed Lump", value: row.fixedLumpValue },
        { name: "Fixed SIP", value: row.fixedSipValue }
      ];
      const best = options.reduce((acc, option) => (option.value > acc.value ? option : acc), options[0]);
      return {
        "Year": row.yearLabel,
        "Snapshot Date": row.date,
        "Bitcoin Price": formatMoney(row.btcPrice),
        "BTC Lump Sum": formatMoney(row.btcLumpValue),
        "BTC DCA": formatMoney(row.btcDcaValue),
        "Fixed Lump Sum": formatMoney(row.fixedLumpValue),
        "Fixed SIP": formatMoney(row.fixedSipValue),
        "Best Strategy": best.name
      };
    });
    renderProjection(headers, rows, "Review where Bitcoin lump sum, Bitcoin DCA, fixed-return lump sum, and fixed-return SIP pull ahead or fall behind over time.", "bitcoin_growth_comparison_projection.csv");
  } else {
    const cagrHeader = result.monthlyContribution > 0 ? "Equivalent CAGR" : "Cumulative CAGR";
    const headers = ["Year", "Snapshot Date", "Bitcoin Price", "Investment Value", "Real Value", "Annual Return %", cagrHeader, "Drawdown %", "Benchmark Value"];
    const rows = result.snapshots.map((row) => ({
      "Year": row.yearLabel,
      "Snapshot Date": row.date,
      "Bitcoin Price": formatMoney(row.btcPrice),
      "Investment Value": formatMoney(row.value),
      "Real Value": formatMoney(row.realValue),
      "Annual Return %": formatPercentDecimal(row.annualReturn),
      [cagrHeader]: formatPercentDecimal(row.cumulativeCagr),
      "Drawdown %": formatPercentDecimal(row.drawdown || 0),
      "Benchmark Value": formatMoney(row.benchmarkValue)
    }));
    renderProjection(headers, rows, "Review Bitcoin price, nominal value, real value, annual return, cumulative CAGR, and drawdown year by year so the path is as clear as the destination.", `bitcoin_growth_${result.mode}_projection.csv`);
  }

  renderCharts(result);
  state.copyText = [
    "Bitcoin Growth Calculator",
    `Mode: ${result.mode === "historical" ? "Historical" : result.mode === "future" ? "Future Projection" : "Comparison"}`,
    `Date range: ${result.startDate} to ${result.endDate}`,
    `Final value: ${formatMoney(result.finalValue)}`,
    `Total invested: ${formatMoney(result.totalInvested)}`,
    `Profit: ${formatMoney(result.profit)}`,
    `Return: ${formatPercentDecimal(result.returnPct)}`,
    `CAGR: ${formatPercentDecimal(result.cagr)}`,
    `Real value: ${formatMoney(result.realValue)}`,
    `Volatility: ${formatPercentDecimal(result.volatility)}`,
    `Max drawdown: ${formatPercentDecimal(result.maxDrawdown)}`,
    `Risk score: ${result.riskScore} / 100`,
    `Quality score: ${result.qualityScore} / 100`
  ].join("\n");

  const profitTone = result.mode === "comparison" ? "" : result.profit >= 0 ? "positive" : "negative";
  const returnTone = result.mode === "comparison" ? "" : result.returnPct >= 0 ? "positive" : "negative";
  setCard(2, $("out-label-2").textContent, $("out-value-2").textContent, $("out-note-2").textContent, profitTone);
  setCard(3, $("out-label-3").textContent, $("out-value-3").textContent, $("out-note-3").textContent, returnTone);
  if (result.mode !== "comparison") {
    setCard(6, $("out-label-6").textContent, $("out-value-6").textContent, $("out-note-6").textContent, result.realValue >= result.totalInvested ? "positive" : "negative");
  }
  setMetricBadge("analytics-badge", `Volatility ${formatPercentDecimal(result.volatility)} · Max DD ${formatPercentDecimal(result.maxDrawdown)}`, result.riskScore >= 70 ? "rose" : result.riskScore >= 45 ? "warning" : "sky");
}

function buildResultFromMode() {
  const builders = { historical: makeHistoricalResult, future: makeFutureResult, comparison: makeComparisonResult };
  return builders[state.activeMode]();
}

function getCacheKey() {
  const ids = cacheInputIds[state.activeMode] || [];
  return `${state.activeMode}|${ids.map((id) => `${id}=${$(id).value}`).join("|")}`;
}

function calculateBitcoin(manual = false, shouldScroll = false) {
  window.clearTimeout(state.calculateTimer);
  state.calculateTimer = null;
  const cacheKey = getCacheKey();
  const result = state.cache.has(cacheKey) ? state.cache.get(cacheKey) : buildResultFromMode();
  if (!state.cache.has(cacheKey) && !result.error) state.cache.set(cacheKey, result);
  renderResult(result);
  if (manual && shouldScroll) $("results").scrollIntoView({ behavior: "smooth", block: "start" });
}

function switchModule(moduleName) {
  state.activeMode = moduleName;
  document.querySelectorAll(".qnav-btn").forEach((button) => {
    const active = button.dataset.module === moduleName;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.querySelectorAll(".module").forEach((section) => {
    section.classList.toggle("active", section.id === `mod-${moduleName}`);
  });
  calculateBitcoin(false);
}

async function copyResults() {
  if (!state.copyText) return;
  try {
    await navigator.clipboard.writeText(state.copyText);
    $("copy-note").classList.remove("hidden");
    $("copy-note").textContent = "Copied to clipboard";
    window.setTimeout(() => $("copy-note").classList.add("hidden"), 2200);
  } catch (error) {
    $("copy-note").textContent = "Copy is blocked in this browser. Select the results manually if needed.";
    $("copy-note").classList.remove("hidden");
  }
}

function downloadCsv() {
  if (!state.csvRows.length) return;
  const headers = Object.keys(state.csvRows[0]);
  const lines = [headers.join(",")];
  state.csvRows.forEach((row) => {
    lines.push(headers.map((header) => `"${String(row[header]).replace(/"/g, '""')}"`).join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = state.csvFilename;
  link.click();
  URL.revokeObjectURL(url);
}

function syncHistoricalTimelineFromDates() {
  const startDate = $("hist-start").value;
  const endDate = $("hist-end").value;
  if (!startDate || !endDate) return;
  const startTime = parseDate(startDate).getTime();
  const endTime = parseDate(endDate).getTime();
  const maxTime = parseDate(lastHistoricalDate).getTime();
  if (maxTime <= startTime) {
    $("hist-timeline-sl").value = 100;
    $("hist-timeline-lbl").textContent = "Full range";
    return;
  }
  const ratio = clamp(Math.round(safeDivide(endTime - startTime, maxTime - startTime) * 100), 0, 100);
  $("hist-timeline-sl").value = ratio;
  $("hist-timeline-lbl").textContent = ratio >= 99 ? "Full range" : `${ratio}% of available historical window`;
}

function updateHistoricalEndFromTimeline() {
  const startDate = $("hist-start").value;
  if (!startDate) return;
  const startTime = parseDate(startDate).getTime();
  const maxTime = parseDate(lastHistoricalDate).getTime();
  const span = maxTime - startTime;
  if (span <= 86400000) {
    $("hist-end").value = lastHistoricalDate;
    syncHistoricalTimelineFromDates();
    queueCalculate();
    return;
  }
  const ratio = parseFloat($("hist-timeline-sl").value) / 100;
  const minTime = startTime + 86400000;
  const targetTime = clamp(startTime + span * ratio, minTime, maxTime);
  $("hist-end").value = toDateInput(new Date(targetTime));
  syncHistoricalTimelineFromDates();
  state.cache.clear();
  queueCalculate();
}

function resetPlanner() {
  const today = new Date();
  const todayIso = toDateInput(today);
  const tenYears = addYearsClamped(today, 10);
  const compareEnd = addYearsClamped(today, 6);

  $("btc-currency").value = "USD";
  $("hist-investment").value = 1000; $("hist-investment-sl").value = 1000;
  $("hist-dca").value = 0; $("hist-dca-sl").value = 0;
  $("hist-start").value = "2017-01-01"; $("hist-end").value = lastHistoricalDate;
  $("hist-stock-rate").value = 8; $("hist-stock-rate-sl").value = 8;
  $("hist-inflation").value = 3; $("hist-inflation-sl").value = 3;
  $("fut-investment").value = 5000; $("fut-investment-sl").value = 5000;
  $("fut-dca").value = 250; $("fut-dca-sl").value = 250;
  $("fut-start").value = todayIso; $("fut-end").value = toDateInput(tenYears);
  $("fut-growth-rate").value = 18; $("fut-growth-rate-sl").value = 18;
  $("fut-stock-rate").value = 8; $("fut-stock-rate-sl").value = 8;
  $("fut-inflation").value = 3; $("fut-inflation-sl").value = 3;
  $("fut-model-style").value = "cycle";
  $("cmp-investment").value = 5000; $("cmp-investment-sl").value = 5000;
  $("cmp-sip").value = 250; $("cmp-sip-sl").value = 250;
  $("cmp-start").value = "2020-01-01"; $("cmp-end").value = toDateInput(compareEnd);
  $("cmp-fixed-rate").value = 8; $("cmp-fixed-rate-sl").value = 8;
  $("cmp-bitcoin-rate").value = 20; $("cmp-bitcoin-rate-sl").value = 20;
  $("cmp-inflation").value = 3; $("cmp-inflation-sl").value = 3;
  $("cmp-source").value = "auto";
  $("cmp-model-style").value = "cycle";
  $("hist-timeline-sl").value = 100;

  state.currentCurrency = "USD";
  state.cache.clear();
  updateCurrencyIndicators();
  sliderConfigs.forEach(updateSliderLabel);
  syncHistoricalTimelineFromDates();
  calculateBitcoin(false);
}

function setDateBounds() {
  $("hist-start").min = firstHistoricalDate; $("hist-start").max = lastHistoricalDate;
  $("hist-end").min = firstHistoricalDate; $("hist-end").max = lastHistoricalDate;
  $("cmp-start").min = firstHistoricalDate; $("cmp-end").min = firstHistoricalDate;
  $("fut-start").min = firstHistoricalDate; $("fut-end").min = firstHistoricalDate;
}

function initMobileNav() {
  const button = $("hamburgerBtn");
  const nav = $("mobileNav");
  button.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    button.setAttribute("aria-expanded", open ? "true" : "false");
  });
}

function init() {
  initMobileNav();
  setDateBounds();
  sliderConfigs.forEach(bindSliderPair);
  ["hist-start", "hist-end", "fut-start", "fut-end", "cmp-start", "cmp-end", "cmp-source", "fut-model-style", "cmp-model-style"].forEach((id) => {
    $(id).addEventListener("change", () => {
      if (id === "hist-start" || id === "hist-end") syncHistoricalTimelineFromDates();
      state.cache.clear();
      queueCalculate();
    });
  });
  $("hist-timeline-sl").addEventListener("input", updateHistoricalEndFromTimeline);
  $("btc-currency").addEventListener("change", () => {
    state.currentCurrency = $("btc-currency").value;
    updateCurrencyIndicators();
    sliderConfigs.forEach(updateSliderLabel);
    calculateBitcoin(false);
  });
  resetPlanner();
}

window.switchModule = switchModule;
window.calculateBitcoin = calculateBitcoin;
window.copyResults = copyResults;
window.downloadCsv = downloadCsv;
window.resetPlanner = resetPlanner;
window.addEventListener("DOMContentLoaded", init);
