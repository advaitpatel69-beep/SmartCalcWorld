(() => {
  const $ = (id) => document.getElementById(id);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const STORAGE_KEY = "scw_unified_trading_dashboard_v3";
  const SHARE_HASH = "#state=";

  const state = {
    currency: "USD",
    trades: [],
    editingId: null,
    selectedTradeId: null,
    sortKey: "netProfit",
    sortDir: "desc",
    uiMode: "advanced",
    theme: "light",
    mcEnabled: true,
    mcRuns: 500,
    mcSteps: 24,
    mcSeed: "SCW-INTEL",
    charts: {
      profit: null,
      allocation: null,
      timeline: null,
      scenario: null,
      mc: null
    },
    renderTimer: null,
    storageTimer: null,
    caches: {
      portfolioKey: "",
      portfolioValue: null,
      mcKey: "",
      mcValue: null
    }
  };

  const currencyConfig = {
    USD: { symbol: "$", locale: "en-US" },
    EUR: { symbol: "\u20AC", locale: "de-DE" },
    GBP: { symbol: "\u00A3", locale: "en-GB" },
    INR: { symbol: "\u20B9", locale: "en-IN" },
    CAD: { symbol: "$", locale: "en-CA" },
    AUD: { symbol: "$", locale: "en-AU" }
  };

  const sliderConfigs = [
    { input: "trade-quantity", slider: "trade-quantity-sl", label: "trade-quantity-lbl", type: "shares" },
    { input: "trade-sell-price", slider: "trade-sell-price-sl", label: "trade-sell-price-lbl", type: "money" },
    { input: "trade-dividend", slider: "trade-dividend-sl", label: "trade-dividend-lbl", type: "money" },
    { input: "trade-target", slider: "trade-target-sl", label: "trade-target-lbl", type: "money" },
    { input: "trade-stop", slider: "trade-stop-sl", label: "trade-stop-lbl", type: "money" },
    { input: "trade-brokerage", slider: "trade-brokerage-sl", label: "trade-brokerage-lbl", type: "brokerage" },
    { input: "trade-charges", slider: "trade-charges-sl", label: "trade-charges-lbl", type: "percent" },
    { input: "trade-tax", slider: "trade-tax-sl", label: "trade-tax-lbl", type: "percent" },
    { input: "trade-buy-slip", slider: "trade-buy-slip-sl", label: "trade-buy-slip-lbl", type: "percent" },
    { input: "trade-sell-slip", slider: "trade-sell-slip-sl", label: "trade-sell-slip-lbl", type: "percent" },
    { input: "trade-volatility", slider: "trade-volatility-sl", label: "trade-volatility-lbl", type: "percent" }
  ];

  const sortAccessors = {
    name: (trade) => trade.name.toLowerCase(),
    investment: (trade) => trade.totalInvestment,
    sellValue: (trade) => trade.afterTaxValue,
    netProfit: (trade) => trade.netProfit,
    netReturnPct: (trade) => trade.netReturnPct,
    breakEven: (trade) => trade.breakEven,
    riskReward: (trade) => trade.riskReward,
    positionRiskPct: (trade) => trade.positionRiskPct,
    feeImpactPct: (trade) => trade.feeImpactPct,
    qualityScore: (trade) => trade.quality.score,
    allocationPct: (trade) => trade.allocationPct
  };

  const Utils = {
    safeNumber(value, fallback = 0) {
      const num = Number(value);
      return Number.isFinite(num) ? num : fallback;
    },
    clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
    },
    normalize(value, min, max) {
      if (!Number.isFinite(value) || max <= min) return 0;
      return Utils.clamp((value - min) / (max - min), 0, 1);
    },
    average(values) {
      return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN;
    },
    stdDev(values) {
      if (!values.length) return NaN;
      const avg = Utils.average(values);
      const variance = Utils.average(values.map((value) => (value - avg) ** 2));
      return Math.sqrt(variance);
    },
    percentile(values, p) {
      if (!values.length) return NaN;
      const sorted = [...values].sort((a, b) => a - b);
      const index = (sorted.length - 1) * Utils.clamp(p, 0, 1);
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      if (lower === upper) return sorted[lower];
      const weight = index - lower;
      return (sorted[lower] * (1 - weight)) + (sorted[upper] * weight);
    },
    uid() {
      return `trade_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    },
    currencyMeta() {
      return currencyConfig[state.currency] || currencyConfig.USD;
    },
    formatMoney(value) {
      if (!Number.isFinite(value)) return "N/A";
      const meta = Utils.currencyMeta();
      const abs = Math.abs(value);
      const formatted = new Intl.NumberFormat(meta.locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(abs);
      return `${value < 0 ? "-" : ""}${meta.symbol}${formatted}`;
    },
    formatPercent(value) {
      return Number.isFinite(value) ? `${value.toFixed(2)}%` : "N/A";
    },
    formatShares(value) {
      if (!Number.isFinite(value)) return "N/A";
      return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)} shares`;
    },
    formatRatio(value) {
      return Number.isFinite(value) && value > 0 ? `${value.toFixed(2)} : 1` : "N/A";
    },
    escapeHtml(text) {
      return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    },
    encodeState(payload) {
      const bytes = new TextEncoder().encode(JSON.stringify(payload));
      let binary = "";
      bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
      return btoa(binary);
    },
    decodeState(encoded) {
      const binary = atob(encoded);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    },
    memoKey(value) {
      return JSON.stringify(value);
    },
    parseCsv(text) {
      const rows = [];
      let row = [];
      let field = "";
      let inQuotes = false;
      for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        if (inQuotes) {
          if (char === '"') {
            if (text[i + 1] === '"') {
              field += '"';
              i += 1;
            } else {
              inQuotes = false;
            }
          } else {
            field += char;
          }
        } else if (char === '"') {
          inQuotes = true;
        } else if (char === ",") {
          row.push(field);
          field = "";
        } else if (char === "\n") {
          row.push(field);
          if (row.some((cell) => cell.trim() !== "")) rows.push(row);
          row = [];
          field = "";
        } else if (char !== "\r") {
          field += char;
        }
      }
      row.push(field);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      return rows;
    },
    downloadTextFile(content, fileName, mimeType = "text/plain;charset=utf-8;") {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const RNG = {
    seedFromText(text) {
      let hash = 2166136261;
      const source = String(text || "SCW-INTEL");
      for (let i = 0; i < source.length; i += 1) {
        hash ^= source.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return hash >>> 0;
    },
    create(seedText) {
      let seed = RNG.seedFromText(seedText);
      return () => {
        seed += 0x6D2B79F5;
        let t = seed;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    normalFactory(uniform) {
      let spare = null;
      return () => {
        if (spare !== null) {
          const cached = spare;
          spare = null;
          return cached;
        }
        let u = 0;
        let v = 0;
        while (u === 0) u = uniform();
        while (v === 0) v = uniform();
        const mag = Math.sqrt(-2 * Math.log(u));
        spare = mag * Math.sin(2 * Math.PI * v);
        return mag * Math.cos(2 * Math.PI * v);
      };
    }
  };

  const TradeMath = {
    defaultEntry(price = 100, quantity = 50) {
      return { price, quantity };
    },
    defaultExit(price = 120, quantity = 25, extraFee = 0) {
      return { price, quantity, extraFee };
    },
    normalizeTrade(rawTrade = {}, index = 0) {
      const entries = Array.isArray(rawTrade.entries) && rawTrade.entries.length
        ? rawTrade.entries
        : [TradeMath.defaultEntry(100, 100)];
      return {
        id: rawTrade.id || Utils.uid(),
        name: String(rawTrade.name || `Trade ${index + 1}`).trim(),
        quantity: Math.max(1, Math.floor(Utils.safeNumber(rawTrade.quantity, 100))),
        sellPrice: Math.max(0, Utils.safeNumber(rawTrade.sellPrice, 120)),
        dividendIncome: Math.max(0, Utils.safeNumber(rawTrade.dividendIncome, 0)),
        targetPrice: Math.max(0, Utils.safeNumber(rawTrade.targetPrice, 132)),
        stopPrice: Math.max(0, Utils.safeNumber(rawTrade.stopPrice, 94)),
        brokerageMode: rawTrade.brokerageMode === "fixed" ? "fixed" : "percent",
        brokerageValue: Math.max(0, Utils.safeNumber(rawTrade.brokerageValue, 0.5)),
        transactionRate: Utils.clamp(Math.max(0, Utils.safeNumber(rawTrade.transactionRate, 0.1)), 0, 50),
        taxRegime: ["custom", "capital", "none"].includes(rawTrade.taxRegime) ? rawTrade.taxRegime : "custom",
        taxRate: Utils.clamp(Math.max(0, Utils.safeNumber(rawTrade.taxRate, 15)), 0, 100),
        taxShortRate: Utils.clamp(Math.max(0, Utils.safeNumber(rawTrade.taxShortRate, 30)), 0, 100),
        taxLongRate: Utils.clamp(Math.max(0, Utils.safeNumber(rawTrade.taxLongRate, 15)), 0, 100),
        holdingMonths: Utils.clamp(Math.max(0, Math.floor(Utils.safeNumber(rawTrade.holdingMonths, 6))), 0, 240),
        lossCarryForward: Math.max(0, Utils.safeNumber(rawTrade.lossCarryForward, 0)),
        buySlippageRate: Utils.clamp(Math.max(0, Utils.safeNumber(rawTrade.buySlippageRate, 0.1)), 0, 95),
        sellSlippageRate: Utils.clamp(Math.max(0, Utils.safeNumber(rawTrade.sellSlippageRate, 0.1)), 0, 95),
        volatilityRate: Utils.clamp(Math.max(0, Utils.safeNumber(rawTrade.volatilityRate, 12)), 0, 500),
        entries: entries.map((entry) => ({
          price: Math.max(0, Utils.safeNumber(entry.price)),
          quantity: Math.max(0, Utils.safeNumber(entry.quantity))
        })).filter((entry) => entry.price > 0 && entry.quantity > 0),
        exits: (rawTrade.exits || []).map((exit) => ({
          price: Math.max(0, Utils.safeNumber(exit.price)),
          quantity: Math.max(0, Utils.safeNumber(exit.quantity)),
          extraFee: Math.max(0, Utils.safeNumber(exit.extraFee))
        })).filter((exit) => exit.price > 0 && exit.quantity > 0)
      };
    },
    calcFees(tradeValue, mode, brokerageValue, chargeRate, extraFixedFee = 0) {
      const safeTradeValue = Math.max(0, tradeValue);
      const brokerage = mode === "fixed" ? brokerageValue : safeTradeValue * (brokerageValue / 100);
      const transactionCharges = safeTradeValue * (chargeRate / 100);
      return {
        brokerage,
        transactionCharges,
        extraFixedFee,
        total: brokerage + transactionCharges + extraFixedFee
      };
    },
    applyBuySlippage(price, slipRate) {
      return price * (1 + (slipRate / 100));
    },
    applySellSlippage(price, slipRate) {
      return price * (1 - (slipRate / 100));
    },
    computeTax(grossProfit, trade) {
      const lossCarry = Math.max(0, trade.lossCarryForward || 0);
      if (!Number.isFinite(grossProfit)) {
        return { tax: 0, taxableGain: 0, rate: 0, usedCarry: 0, remainingCarry: lossCarry };
      }
      if (trade.taxRegime === "none") {
        const newCarry = grossProfit < 0 ? lossCarry + Math.abs(grossProfit) : lossCarry;
        return { tax: 0, taxableGain: 0, rate: 0, usedCarry: 0, remainingCarry: newCarry };
      }
      const carryApplied = grossProfit > 0 ? Math.min(lossCarry, grossProfit) : 0;
      const taxableGain = Math.max(grossProfit - carryApplied, 0);
      const rate = trade.taxRegime === "capital"
        ? (trade.holdingMonths >= 12 ? trade.taxLongRate : trade.taxShortRate)
        : trade.taxRate;
      const tax = taxableGain * (rate / 100);
      const remainingCarry = grossProfit < 0 ? lossCarry + Math.abs(grossProfit) : Math.max(lossCarry - carryApplied, 0);
      return {
        tax,
        taxableGain,
        rate,
        usedCarry: carryApplied,
        remainingCarry
      };
    },
    computeRiskReward(avgBuy, target, stop) {
      if (!Number.isFinite(avgBuy) || avgBuy <= 0 || !Number.isFinite(target) || !Number.isFinite(stop)) return NaN;
      const reward = target - avgBuy;
      const risk = avgBuy - stop;
      if (reward <= 0 || risk <= 0) return NaN;
      return reward / risk;
    },
    computePositionRisk(avgBuy, stop) {
      if (!Number.isFinite(avgBuy) || avgBuy <= 0 || !Number.isFinite(stop) || stop <= 0 || stop >= avgBuy) return NaN;
      return ((avgBuy - stop) / avgBuy) * 100;
    },
    qualityLabel(score) {
      if (score >= 80) return { label: "Excellent", tone: "excellent" };
      if (score >= 60) return { label: "Good", tone: "good" };
      if (score >= 35) return { label: "Average", tone: "average" };
      return { label: "Poor", tone: "poor" };
    },
    qualityScore(metrics) {
      const returnNorm = Utils.normalize(metrics.netReturnPct, -20, 40);
      const rrNorm = Number.isFinite(metrics.riskReward) ? Utils.normalize(metrics.riskReward, 0.5, 4) : 0;
      const feePenalty = Utils.normalize(metrics.feeImpactPct, 0, 6);
      const capitalEfficiency = Utils.normalize(metrics.liquidationMultiple, 0.9, 1.4);
      const drawdownControl = Number.isFinite(metrics.positionRiskPct)
        ? (1 - Utils.normalize(metrics.positionRiskPct, 3, 25))
        : 0.2;
      const score = Utils.clamp(
        (0.3 * returnNorm) +
        (0.25 * rrNorm) +
        (0.2 * (1 - feePenalty)) +
        (0.15 * capitalEfficiency) +
        (0.1 * drawdownControl),
        0,
        1
      ) * 100;
      const label = TradeMath.qualityLabel(score);
      return {
        score,
        label: label.label,
        tone: label.tone,
        capitalEfficiency,
        drawdownControl
      };
    },
    scenarioBlueprints(trade, basePrice) {
      const anchor = Math.max(basePrice || trade.sellPrice || trade.averageBuyPrice || 1, 0.01);
      const volFactor = Utils.clamp(trade.raw.volatilityRate, 0, 500) / 100;
      const stopPrice = trade.raw.stopPrice > 0 ? trade.raw.stopPrice : Math.max(anchor * (1 - volFactor), 0.01);
      const dipPrice = Math.max(anchor * (1 - volFactor), 0.01);
      const targetPrice = trade.raw.targetPrice > 0 ? trade.raw.targetPrice : anchor * (1 + volFactor);
      const stretchPrice = trade.raw.targetPrice > 0 ? trade.raw.targetPrice * (1 + (volFactor / 2)) : anchor * (1 + (volFactor * 1.5));
      return [
        { label: "Protective Stop", price: stopPrice },
        { label: "Volatility Dip", price: dipPrice },
        { label: "Base Exit", price: anchor },
        { label: "Target", price: targetPrice },
        { label: "Stretch", price: stretchPrice }
      ].filter((item) => item.price > 0);
    },
    computeBreakEven(trade, requiredRecovery) {
      if (trade.openQuantity <= 0 || requiredRecovery <= 0) return requiredRecovery <= 0 ? 0 : NaN;
      const slipFactor = 1 - (trade.raw.sellSlippageRate / 100);
      if (slipFactor <= 0) return NaN;
      if (trade.raw.brokerageMode === "fixed") {
        const chargeFactor = 1 - (trade.raw.transactionRate / 100);
        const denominator = trade.openQuantity * slipFactor * chargeFactor;
        if (denominator <= 0) return NaN;
        return (requiredRecovery + trade.raw.brokerageValue) / denominator;
      }
      const chargeFactor = 1 - ((trade.raw.brokerageValue + trade.raw.transactionRate) / 100);
      const denominator = trade.openQuantity * slipFactor * chargeFactor;
      if (denominator <= 0) return NaN;
      return requiredRecovery / denominator;
    },
    evaluateTradeAtPrice(trade, quotedPrice, label = "Dynamic Exit") {
      const safeQuote = Math.max(0.01, quotedPrice);
      let openNetProceeds = 0;
      let openFees = 0;
      let actualSellPrice = safeQuote;
      if (trade.openQuantity > 0) {
        actualSellPrice = TradeMath.applySellSlippage(safeQuote, trade.raw.sellSlippageRate);
        const sellGross = actualSellPrice * trade.openQuantity;
        const fees = TradeMath.calcFees(
          sellGross,
          trade.raw.brokerageMode,
          trade.raw.brokerageValue,
          trade.raw.transactionRate
        );
        openFees = fees.total;
        openNetProceeds = sellGross - fees.total;
      }
      const preTaxValue = trade.realizedNetProceeds + openNetProceeds + trade.raw.dividendIncome;
      const grossProfit = preTaxValue - trade.totalInvestment;
      const taxData = TradeMath.computeTax(grossProfit, trade.raw);
      const afterTaxValue = preTaxValue - taxData.tax;
      const netProfit = afterTaxValue - trade.totalInvestment;
      const netReturnPct = trade.totalInvestment > 0 ? (netProfit / trade.totalInvestment) * 100 : 0;
      return {
        label,
        quotedSellPrice: safeQuote,
        actualSellPrice,
        openNetProceeds,
        openFees,
        preTaxValue,
        afterTaxValue,
        grossProfit,
        tax: taxData.tax,
        taxableGain: taxData.taxableGain,
        taxRateApplied: taxData.rate,
        carriedLossUsed: taxData.usedCarry,
        remainingCarry: taxData.remainingCarry,
        netProfit,
        netReturnPct
      };
    },
    tradeTone(trade) {
      if (trade.netProfit < 0 || trade.positionRiskPct > 15 || trade.feeImpactPct > 2.25) return "danger";
      if (trade.quality.score < 60 || trade.positionRiskPct > 8 || trade.maxDrawdownEstimatePct > 18) return "warn";
      return "good";
    },
    computeTrade(rawTrade, index = 0) {
      const trade = TradeMath.normalizeTrade(rawTrade, index);
      if (!trade.entries.length) {
        return { valid: false, message: `Trade "${trade.name}" needs at least one valid buy entry.` };
      }
      const totalBoughtQuantity = trade.entries.reduce((sum, entry) => sum + entry.quantity, 0);
      if (totalBoughtQuantity <= 0) {
        return { valid: false, message: `Trade "${trade.name}" has no valid share quantity.` };
      }
      const analyzedQuantity = Math.min(Math.max(1, Math.floor(trade.quantity)), totalBoughtQuantity);
      let warning = "";
      if (trade.quantity > totalBoughtQuantity) {
        warning = `Requested quantity was capped at ${analyzedQuantity} shares because it cannot exceed the total bought quantity.`;
      } else if (trade.quantity < totalBoughtQuantity) {
        warning = `Partial exit: analyzing ${analyzedQuantity} of ${totalBoughtQuantity} bought shares. Buy fees are allocated proportionally.`;
      }

      const totalQuotedEntryCost = trade.entries.reduce((sum, entry) => sum + (entry.price * entry.quantity), 0);
      const totalExecutedEntryCost = trade.entries.reduce((sum, entry) => sum + (TradeMath.applyBuySlippage(entry.price, trade.buySlippageRate) * entry.quantity), 0);
      const totalBuyFees = trade.entries.reduce((sum, entry) => {
        const executedValue = TradeMath.applyBuySlippage(entry.price, trade.buySlippageRate) * entry.quantity;
        return sum + TradeMath.calcFees(executedValue, trade.brokerageMode, trade.brokerageValue, trade.transactionRate).total;
      }, 0);
      const allInCostPerShare = (totalExecutedEntryCost + totalBuyFees) / totalBoughtQuantity;
      const quotedAverageBuyPrice = totalQuotedEntryCost / totalBoughtQuantity;
      const averageBuyPrice = totalExecutedEntryCost / totalBoughtQuantity;
      const totalInvestment = allInCostPerShare * analyzedQuantity;
      const allocatedBuyFees = totalBuyFees * (analyzedQuantity / totalBoughtQuantity);

      const realizedExits = [];
      let remainingQuantity = analyzedQuantity;
      let realizedNetProceeds = 0;
      let realizedFees = 0;
      let realizedCost = 0;
      let excessExitQuantity = 0;

      trade.exits.forEach((exit) => {
        const qty = Math.min(exit.quantity, remainingQuantity);
        if (qty <= 0) {
          excessExitQuantity += exit.quantity;
          return;
        }
        const actualSellPrice = TradeMath.applySellSlippage(exit.price, trade.sellSlippageRate);
        const gross = actualSellPrice * qty;
        const fees = TradeMath.calcFees(gross, trade.brokerageMode, trade.brokerageValue, trade.transactionRate, exit.extraFee);
        const net = gross - fees.total;
        const allocatedCost = allInCostPerShare * qty;
        realizedExits.push({
          quotedPrice: exit.price,
          actualSellPrice,
          quantity: qty,
          extraFee: exit.extraFee,
          fees: fees.total,
          netProceeds: net,
          allocatedCost,
          realizedProfit: net - allocatedCost
        });
        realizedNetProceeds += net;
        realizedFees += fees.total;
        realizedCost += allocatedCost;
        remainingQuantity -= qty;
        excessExitQuantity += Math.max(0, exit.quantity - qty);
      });

      if (excessExitQuantity > 0) {
        warning = `${warning} Staged exits were capped because they exceeded the analyzed share count.`.trim();
      }

      // Use remainingQuantity when exit rows were defined (even if all filtered to zero),
      // so a partial-exit trade does not silently revert to treating all shares as open.
      const hasDefinedExits = (rawTrade.exits || []).length > 0;
      const openQuantity = hasDefinedExits ? remainingQuantity : analyzedQuantity;
      const scenarioSource = {
        raw: trade,
        totalInvestment,
        openQuantity,
        realizedNetProceeds
      };
      const baseOutcome = TradeMath.evaluateTradeAtPrice(scenarioSource, trade.sellPrice, "Base Exit");
      const riskReward = TradeMath.computeRiskReward(averageBuyPrice, trade.targetPrice, trade.stopPrice);
      const positionRiskPct = TradeMath.computePositionRisk(averageBuyPrice, trade.stopPrice);
      const liquidationMultiple = totalInvestment > 0 ? (baseOutcome.afterTaxValue / totalInvestment) : 0;
      const totalFees = allocatedBuyFees + realizedFees + baseOutcome.openFees;
      const feeImpactPct = totalInvestment > 0 ? (totalFees / totalInvestment) * 100 : 0;
      const effectiveCostPerShare = analyzedQuantity > 0 ? totalInvestment / analyzedQuantity : NaN;
      const profitPerShare = analyzedQuantity > 0 ? baseOutcome.netProfit / analyzedQuantity : NaN;
      const requiredRecovery = totalInvestment - realizedNetProceeds - trade.dividendIncome;
      const breakEven = TradeMath.computeBreakEven({
        raw: trade,
        openQuantity
      }, requiredRecovery);
      const quality = TradeMath.qualityScore({
        netReturnPct: baseOutcome.netReturnPct,
        riskReward,
        feeImpactPct,
        liquidationMultiple,
        positionRiskPct
      });

      const scenarios = TradeMath.scenarioBlueprints({ raw: trade }, trade.sellPrice).map((scenario) => {
        const outcome = TradeMath.evaluateTradeAtPrice(scenarioSource, scenario.price, scenario.label);
        return {
          label: scenario.label,
          quotedSellPrice: scenario.price,
          actualSellPrice: outcome.actualSellPrice,
          netProfit: outcome.netProfit,
          netReturnPct: outcome.netReturnPct,
          afterTaxValue: outcome.afterTaxValue
        };
      });

      const baseValue = baseOutcome.afterTaxValue;
      const scenarioValues = scenarios.map((scenario) => scenario.afterTaxValue);
      const maxDrawdownEstimatePct = baseValue > 0 && scenarioValues.length
        ? ((baseValue - Math.min(...scenarioValues)) / baseValue) * 100
        : NaN;
      const heatTone = TradeMath.tradeTone({
        netProfit: baseOutcome.netProfit,
        positionRiskPct,
        feeImpactPct,
        quality,
        maxDrawdownEstimatePct
      });

      return {
        valid: true,
        id: trade.id,
        name: trade.name,
        raw: trade,
        warning,
        totalBoughtQuantity,
        analyzedQuantity,
        openQuantity,
        realizedQuantity: analyzedQuantity - openQuantity,
        quotedAverageBuyPrice,
        averageBuyPrice,
        allInCostPerShare,
        totalInvestment,
        afterTaxValue: baseOutcome.afterTaxValue,
        preTaxValue: baseOutcome.preTaxValue,
        grossProfit: baseOutcome.grossProfit,
        netProfit: baseOutcome.netProfit,
        netReturnPct: baseOutcome.netReturnPct,
        breakEven,
        riskReward,
        positionRiskPct,
        effectiveCostPerShare,
        profitPerShare,
        feeImpactPct,
        taxImpactPct: baseOutcome.grossProfit > 0 ? (baseOutcome.tax / baseOutcome.grossProfit) * 100 : NaN,
        tax: baseOutcome.tax,
        taxableGain: baseOutcome.taxableGain,
        taxRateApplied: baseOutcome.taxRateApplied,
        remainingCarry: baseOutcome.remainingCarry,
        quality,
        buyFees: allocatedBuyFees,
        totalFees,
        realizedNetProceeds,
        realizedCost,
        realizedExits,
        dividendIncome: trade.dividendIncome,
        sellPrice: trade.sellPrice,
        actualSellPrice: baseOutcome.actualSellPrice,
        allocationPct: 0,
        liquidationMultiple,
        capitalEfficiency: quality.capitalEfficiency,
        drawdownControl: quality.drawdownControl,
        maxDrawdownEstimatePct,
        scenarios,
        heatTone
      };
    },
    computeMonteCarlo(portfolio) {
      if (!state.mcEnabled || !portfolio.trades.length) return null;
      const runs = Utils.clamp(Math.round(Utils.safeNumber(state.mcRuns, 500)), 100, 2000);
      const steps = Utils.clamp(Math.round(Utils.safeNumber(state.mcSteps, 24)), 6, 60);
      const key = Utils.memoKey({
        runs,
        steps,
        seed: state.mcSeed,
        trades: portfolio.trades.map((trade) => ({
          id: trade.id,
          invested: trade.totalInvestment,
          sellPrice: trade.sellPrice,
          targetPrice: trade.raw.targetPrice,
          openQuantity: trade.openQuantity,
          realizedNetProceeds: trade.realizedNetProceeds,
          dividendIncome: trade.raw.dividendIncome,
          brokerageMode: trade.raw.brokerageMode,
          brokerageValue: trade.raw.brokerageValue,
          transactionRate: trade.raw.transactionRate,
          sellSlippageRate: trade.raw.sellSlippageRate,
          taxRegime: trade.raw.taxRegime,
          taxRate: trade.raw.taxRate,
          taxShortRate: trade.raw.taxShortRate,
          taxLongRate: trade.raw.taxLongRate,
          holdingMonths: trade.raw.holdingMonths,
          lossCarryForward: trade.raw.lossCarryForward,
          volatilityRate: trade.raw.volatilityRate
        }))
      });
      if (state.caches.mcKey === key && state.caches.mcValue) return state.caches.mcValue;

      const labels = Array.from({ length: steps + 1 }, (_, step) => `Step ${step}`);
      const stepBuckets = Array.from({ length: steps + 1 }, () => []);
      const finalValues = [];
      const finalProfits = [];
      const drawdowns = [];

      for (let run = 0; run < runs; run += 1) {
        const uniform = RNG.create(`${state.mcSeed}-${run}`);
        const normal = RNG.normalFactory(uniform);
        const livePrices = portfolio.trades.map((trade) => Math.max(trade.sellPrice || trade.averageBuyPrice || 1, 0.01));
        let pathPeak = portfolio.totalAfterTaxValue;
        let pathDrawdown = 0;
        stepBuckets[0].push(portfolio.totalAfterTaxValue);

        for (let step = 1; step <= steps; step += 1) {
          let portfolioValue = 0;
          portfolio.trades.forEach((trade, index) => {
            if (trade.openQuantity > 0) {
              const sigma = Utils.clamp(trade.raw.volatilityRate / 100, 0, 2.5);
              const basePrice = Math.max(trade.sellPrice || trade.averageBuyPrice || 1, 0.01);
              const targetAnchor = trade.raw.targetPrice > 0 ? trade.raw.targetPrice : basePrice;
              const mu = Math.log(Math.max(targetAnchor, 0.01) / basePrice);
              const shock = normal();
              const dt = 1 / steps;
              livePrices[index] = Math.max(0.01, livePrices[index] * Math.exp(((mu - (0.5 * sigma * sigma)) * dt) + (sigma * Math.sqrt(dt) * shock)));
              portfolioValue += TradeMath.evaluateTradeAtPrice(trade, livePrices[index], `MC ${step}`).afterTaxValue;
            } else {
              portfolioValue += trade.afterTaxValue;
            }
          });
          stepBuckets[step].push(portfolioValue);
          pathPeak = Math.max(pathPeak, portfolioValue);
          if (pathPeak > 0) {
            pathDrawdown = Math.max(pathDrawdown, ((pathPeak - portfolioValue) / pathPeak) * 100);
          }
        }

        const finalValue = stepBuckets[steps][stepBuckets[steps].length - 1];
        finalValues.push(finalValue);
        finalProfits.push(finalValue - portfolio.totalInvested);
        drawdowns.push(pathDrawdown);
      }

      const returns = finalValues.map((value) => portfolio.totalInvested > 0 ? ((value - portfolio.totalInvested) / portfolio.totalInvested) * 100 : 0);
      const result = {
        runs,
        steps,
        labels,
        p10Path: stepBuckets.map((values) => Utils.percentile(values, 0.1)),
        p50Path: stepBuckets.map((values) => Utils.percentile(values, 0.5)),
        p90Path: stepBuckets.map((values) => Utils.percentile(values, 0.9)),
        p10: Utils.percentile(finalValues, 0.1),
        p50: Utils.percentile(finalValues, 0.5),
        p90: Utils.percentile(finalValues, 0.9),
        profitProbabilityPct: (finalProfits.filter((profit) => profit > 0).length / runs) * 100,
        lossProbabilityPct: (finalProfits.filter((profit) => profit < 0).length / runs) * 100,
        volatilityPct: Utils.stdDev(returns),
        avgDrawdownPct: Utils.average(drawdowns),
        stressDrawdownPct: Utils.percentile(drawdowns, 0.9)
      };
      state.caches.mcKey = key;
      state.caches.mcValue = result;
      return result;
    },
    computePortfolio(trades) {
      const normalizedTrades = trades.map((trade, index) => TradeMath.normalizeTrade(trade, index));
      const key = Utils.memoKey(normalizedTrades);
      if (state.caches.portfolioKey === key && state.caches.portfolioValue) return state.caches.portfolioValue;

      const computed = normalizedTrades.map((trade, index) => TradeMath.computeTrade(trade, index)).filter((trade) => trade.valid);
      const totalInvested = computed.reduce((sum, trade) => sum + trade.totalInvestment, 0);
      const totalSellValue = computed.reduce((sum, trade) => sum + trade.afterTaxValue, 0);
      const totalProfit = computed.reduce((sum, trade) => sum + trade.netProfit, 0);
      const overallReturnPct = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

      computed.forEach((trade) => {
        trade.allocationPct = totalInvested > 0 ? (trade.totalInvestment / totalInvested) * 100 : 0;
      });

      const validRRTrades = computed.filter((trade) => Number.isFinite(trade.riskReward));
      const avgRiskReward = validRRTrades.length
        ? validRRTrades.reduce((sum, trade) => sum + (trade.riskReward * trade.totalInvestment), 0) /
          validRRTrades.reduce((sum, trade) => sum + trade.totalInvestment, 0)
        : NaN;
      const avgFeeDrag = totalInvested > 0
        ? computed.reduce((sum, trade) => sum + (trade.feeImpactPct * trade.totalInvestment), 0) / totalInvested
        : NaN;
      const portfolioRiskExposure = totalInvested > 0
        ? computed.reduce((sum, trade) => sum + ((Number.isFinite(trade.positionRiskPct) ? trade.positionRiskPct : 0) * (trade.totalInvestment / totalInvested)), 0)
        : NaN;
      const weightedVolatility = totalInvested > 0
        ? Math.sqrt(computed.reduce((sum, trade) => {
          const weight = trade.totalInvestment / totalInvested;
          return sum + ((weight * trade.raw.volatilityRate) ** 2);
        }, 0))
        : NaN;
      const qualityScore = totalInvested > 0
        ? computed.reduce((sum, trade) => sum + (trade.quality.score * trade.totalInvestment), 0) / totalInvested
        : 0;
      const quality = TradeMath.qualityLabel(qualityScore);
      const scenarioOrder = ["Protective Stop", "Volatility Dip", "Base Exit", "Target", "Stretch"];
      const scenarioTotals = scenarioOrder.map((label) => {
        const netProfit = computed.reduce((sum, trade) => {
          const scenario = trade.scenarios.find((item) => item.label === label);
          return sum + (scenario ? scenario.netProfit : 0);
        }, 0);
        return {
          label,
          netProfit,
          afterTaxValue: totalInvested + netProfit
        };
      });
      const worstCaseLoss = computed.reduce((sum, trade) => {
        const stopScenario = trade.scenarios.find((scenario) => scenario.label === "Protective Stop");
        return sum + Math.min(stopScenario ? stopScenario.netProfit : 0, 0);
      }, 0);
      const topTrade = computed.reduce((best, trade) => (!best || trade.netProfit > best.netProfit ? trade : best), null);
      const maxAllocation = computed.reduce((max, trade) => Math.max(max, trade.allocationPct), 0);

      let cumulativeInvested = 0;
      let cumulativeValue = 0;
      let cumulativeProfit = 0;
      const timeline = computed.map((trade) => {
        cumulativeInvested += trade.totalInvestment;
        cumulativeValue += trade.afterTaxValue;
        cumulativeProfit += trade.netProfit;
        return {
          label: trade.name,
          invested: cumulativeInvested,
          value: cumulativeValue,
          profit: cumulativeProfit
        };
      });

      const scenarioBase = scenarioTotals.find((item) => item.label === "Base Exit");
      const maxDrawdownEstimatePct = scenarioBase && scenarioBase.afterTaxValue > 0
        ? ((scenarioBase.afterTaxValue - Math.min(...scenarioTotals.map((item) => item.afterTaxValue))) / scenarioBase.afterTaxValue) * 100
        : NaN;
      const sharpeLike = Number.isFinite(weightedVolatility) && weightedVolatility > 0
        ? overallReturnPct / weightedVolatility
        : NaN;

      const portfolio = {
        trades: computed,
        totalInvested,
        totalAfterTaxValue: totalSellValue,
        totalProfit,
        overallReturnPct,
        avgRiskReward,
        avgFeeDrag,
        portfolioRiskExposure,
        weightedVolatility,
        sharpeLike,
        qualityScore,
        quality,
        worstCaseLoss,
        timeline,
        scenarioTotals,
        topTrade,
        maxAllocation,
        maxDrawdownEstimatePct
      };
      state.caches.portfolioKey = key;
      state.caches.portfolioValue = portfolio;
      return portfolio;
    }
  };

  const Persistence = {
    payload() {
      return {
        currency: state.currency,
        trades: state.trades,
        selectedTradeId: state.selectedTradeId,
        sortKey: state.sortKey,
        sortDir: state.sortDir,
        uiMode: state.uiMode,
        theme: state.theme,
        mcEnabled: state.mcEnabled,
        mcRuns: state.mcRuns,
        mcSteps: state.mcSteps,
        mcSeed: state.mcSeed
      };
    },
    saveLocalState() {
      clearTimeout(state.storageTimer);
      state.storageTimer = window.setTimeout(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Persistence.payload()));
      }, 120);
    },
    loadLocalState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        Persistence.applyPayload(JSON.parse(raw));
        return true;
      } catch {
        return false;
      }
    },
    saveUrlState() {
      const encoded = encodeURIComponent(Utils.encodeState(Persistence.payload()));
      history.replaceState(null, "", `${location.pathname}${SHARE_HASH}${encoded}`);
    },
    loadUrlState() {
      const hash = location.hash || "";
      if (!hash.startsWith(SHARE_HASH)) return false;
      try {
        const payload = Utils.decodeState(decodeURIComponent(hash.slice(SHARE_HASH.length)));
        Persistence.applyPayload(payload);
        return true;
      } catch {
        return false;
      }
    },
    applyPayload(payload = {}) {
      state.currency = payload.currency || state.currency;
      state.trades = Array.isArray(payload.trades) ? payload.trades.map((trade, index) => TradeMath.normalizeTrade(trade, index)) : [];
      state.selectedTradeId = payload.selectedTradeId || null;
      state.sortKey = payload.sortKey || state.sortKey;
      state.sortDir = payload.sortDir || state.sortDir;
      state.uiMode = payload.uiMode === "beginner" ? "beginner" : "advanced";
      state.theme = payload.theme === "dark" ? "dark" : "light";
      state.mcEnabled = payload.mcEnabled !== false;
      state.mcRuns = Utils.clamp(Utils.safeNumber(payload.mcRuns, 500), 100, 2000);
      state.mcSteps = Utils.clamp(Utils.safeNumber(payload.mcSteps, 24), 6, 60);
      state.mcSeed = String(payload.mcSeed || "SCW-INTEL");
    }
  };

  const UI = {
    setCopyNote(text) {
      $("copy-note").textContent = text;
    },
    syncCurrencyIndicators() {
      const symbol = Utils.currencyMeta().symbol;
      $$("[data-currency-symbol]").forEach((node) => { node.textContent = symbol; });
    },
    updateSliderLabel(config) {
      const input = $(config.input);
      const label = $(config.label);
      if (!input || !label) return;
      const value = Utils.safeNumber(input.value);
      if (config.type === "money") label.textContent = Utils.formatMoney(value);
      else if (config.type === "shares") label.textContent = Utils.formatShares(value);
      else if (config.type === "brokerage") label.textContent = $("trade-fee-mode").value === "fixed" ? Utils.formatMoney(value) : Utils.formatPercent(value);
      else label.textContent = Utils.formatPercent(value);
    },
    bindSliderPairs() {
      sliderConfigs.forEach((config) => {
        const input = $(config.input);
        const slider = $(config.slider);
        input.addEventListener("input", () => {
          const raw = Utils.safeNumber(input.value);
          const clamped = Utils.clamp(raw, Utils.safeNumber(slider.min, raw), Utils.safeNumber(slider.max, raw));
          input.value = clamped;
          slider.value = clamped;
          UI.updateSliderLabel(config);
          UI.refreshDraftStatus();
        });
        slider.addEventListener("input", () => {
          input.value = slider.value;
          UI.updateSliderLabel(config);
          UI.refreshDraftStatus();
        });
      });
    },
    applyUiState() {
      document.body.classList.toggle("beginner-mode", state.uiMode === "beginner");
      document.body.classList.toggle("dark-mode", state.theme === "dark");
      $("ui-mode-beginner").classList.toggle("active", state.uiMode === "beginner");
      $("ui-mode-advanced").classList.toggle("active", state.uiMode === "advanced");
      $("theme-light").classList.toggle("active", state.theme === "light");
      $("theme-dark").classList.toggle("active", state.theme === "dark");
      $("storage-status").textContent = state.theme === "dark"
        ? "Dark mode and autosave are active. Your saved portfolio reloads here unless a shareable URL is opened."
        : "Autosave is active. Your portfolio loads again from this browser unless a shareable URL overrides it.";
    },
    syncBrokerageMode() {
      const fixed = $("trade-fee-mode").value === "fixed";
      const input = $("trade-brokerage");
      const slider = $("trade-brokerage-sl");
      const current = Utils.safeNumber(input.value);
      if (fixed) {
        $("brokerage-label").innerHTML = `Brokerage Fee (<span data-currency-symbol>${Utils.currencyMeta().symbol}</span>)`;
        $("fee-mode-hint").textContent = "Fixed mode applies the brokerage amount to each buy order, staged exit row, and remaining open-position liquidation.";
        input.min = "0";
        input.max = "10000";
        input.step = "1";
        slider.min = "0";
        slider.max = "10000";
        slider.step = "1";
        if (current < 1) {
          input.value = "5";
          slider.value = "5";
        }
      } else {
        $("brokerage-label").textContent = "Brokerage Fee (%)";
        $("fee-mode-hint").textContent = "Percentage mode applies brokerage as a rate on each buy order, staged exit, and remaining open-position liquidation.";
        input.min = "0";
        input.max = "5";
        input.step = "0.01";
        slider.min = "0";
        slider.max = "5";
        slider.step = "0.01";
        if (current > 5) {
          input.value = "0.5";
          slider.value = "0.5";
        }
      }
      UI.syncCurrencyIndicators();
      UI.updateSliderLabel({ input: "trade-brokerage", slider: "trade-brokerage-sl", label: "trade-brokerage-lbl", type: "brokerage" });
    },
    syncTaxMode() {
      const regime = $("trade-tax-regime").value;
      $("custom-tax-wrap").hidden = regime !== "custom";
      $$(".tax-capital-field").forEach((node) => { node.hidden = regime !== "capital"; });
      if (regime === "custom") {
        $("tax-mode-hint").textContent = "Flat tax mode applies one rate to positive gains after any loss carry-forward offset.";
      } else if (regime === "capital") {
        $("tax-mode-hint").textContent = "Capital gains mode switches automatically between short-term and long-term tax rates using the holding period input.";
      } else {
        $("tax-mode-hint").textContent = "Ignore tax mode keeps the liquidation analysis pre-tax while still tracking fee drag and risk.";
      }
    },
    defaultEntries() {
      return [TradeMath.defaultEntry(100, 60), TradeMath.defaultEntry(102, 40)];
    },
    defaultExits() {
      return [];
    },
    defaultTradeName() {
      return `Trade ${state.trades.length + 1}`;
    },
    samplePortfolio() {
      return [
        TradeMath.normalizeTrade({
          name: "Momentum Breakout",
          quantity: 100,
          sellPrice: 124,
          dividendIncome: 0,
          targetPrice: 132,
          stopPrice: 96,
          brokerageMode: "percent",
          brokerageValue: 0.4,
          transactionRate: 0.1,
          taxRegime: "capital",
          taxShortRate: 28,
          taxLongRate: 15,
          holdingMonths: 14,
          buySlippageRate: 0.1,
          sellSlippageRate: 0.1,
          volatilityRate: 10,
          entries: [{ price: 98, quantity: 50 }, { price: 101, quantity: 50 }],
          exits: [{ price: 118, quantity: 35, extraFee: 1.5 }, { price: 126, quantity: 25, extraFee: 1.5 }]
        }),
        TradeMath.normalizeTrade({
          name: "Pullback Add",
          quantity: 80,
          sellPrice: 86,
          dividendIncome: 24,
          targetPrice: 92,
          stopPrice: 74,
          brokerageMode: "fixed",
          brokerageValue: 7,
          transactionRate: 0.08,
          taxRegime: "custom",
          taxRate: 12,
          lossCarryForward: 150,
          buySlippageRate: 0.12,
          sellSlippageRate: 0.1,
          volatilityRate: 14,
          entries: [{ price: 79, quantity: 30 }, { price: 76, quantity: 50 }],
          exits: [{ price: 84, quantity: 30, extraFee: 2 }]
        }),
        TradeMath.normalizeTrade({
          name: "Dividend Swing",
          quantity: 120,
          sellPrice: 54,
          dividendIncome: 75,
          targetPrice: 57,
          stopPrice: 47,
          brokerageMode: "percent",
          brokerageValue: 0.35,
          transactionRate: 0.06,
          taxRegime: "none",
          buySlippageRate: 0.08,
          sellSlippageRate: 0.08,
          volatilityRate: 8,
          entries: [{ price: 49, quantity: 60 }, { price: 51, quantity: 60 }],
          exits: [{ price: 53, quantity: 40, extraFee: 0 }]
        })
      ];
    },
    renderEntryRows(entries = UI.defaultEntries()) {
      $("entry-list").innerHTML = entries.map((entry, index) => `
        <div class="entry-row" data-index="${index}">
          <div class="form-row">
            <label class="lbl">Buy Price</label>
            <input type="number" class="entry-price" min="0" max="100000" step="0.01" value="${entry.price}">
          </div>
          <div class="form-row">
            <label class="lbl">Shares</label>
            <input type="number" class="entry-qty" min="1" max="1000000" step="1" value="${entry.quantity}">
          </div>
          <div class="form-row">
            <label class="lbl">Entry Value</label>
            <div class="slider-lbl">${Utils.formatMoney(entry.price * entry.quantity)}</div>
          </div>
          <button type="button" class="micro-btn danger" data-entry-action="remove">Remove</button>
        </div>
      `).join("");
    },
    renderExitRows(exits = UI.defaultExits()) {
      if (!exits.length) {
        $("exit-list").innerHTML = `<div class="status-banner warning">No staged exits yet. Keep the fallback exit price for a simple trade, or add exit rows to model partial sells.</div>`;
        return;
      }
      $("exit-list").innerHTML = exits.map((exit, index) => `
        <div class="entry-row exit-row" data-index="${index}">
          <div class="form-row">
            <label class="lbl">Exit Price</label>
            <input type="number" class="exit-price" min="0" max="100000" step="0.01" value="${exit.price}">
          </div>
          <div class="form-row">
            <label class="lbl">Shares</label>
            <input type="number" class="exit-qty" min="1" max="1000000" step="1" value="${exit.quantity}">
          </div>
          <div class="form-row">
            <label class="lbl">Extra Fixed Fee</label>
            <input type="number" class="exit-fee" min="0" max="100000" step="0.01" value="${exit.extraFee || 0}">
          </div>
          <div class="form-row">
            <label class="lbl">Exit Value</label>
            <div class="slider-lbl">${Utils.formatMoney(exit.price * exit.quantity)}</div>
          </div>
          <button type="button" class="micro-btn danger" data-exit-action="remove">Remove</button>
        </div>
      `).join("");
    },
    readEntries() {
      return $$("#entry-list .entry-row").map((row) => ({
        price: Math.max(0, Utils.safeNumber(row.querySelector(".entry-price").value)),
        quantity: Math.max(0, Utils.safeNumber(row.querySelector(".entry-qty").value))
      })).filter((entry) => entry.price > 0 && entry.quantity > 0);
    },
    readExits() {
      return $$("#exit-list .exit-row").map((row) => ({
        price: Math.max(0, Utils.safeNumber(row.querySelector(".exit-price").value)),
        quantity: Math.max(0, Utils.safeNumber(row.querySelector(".exit-qty").value)),
        extraFee: Math.max(0, Utils.safeNumber(row.querySelector(".exit-fee").value))
      })).filter((exit) => exit.price > 0 && exit.quantity > 0);
    },
    collectEditorTrade() {
      return TradeMath.normalizeTrade({
        id: state.editingId || Utils.uid(),
        name: ($("trade-name").value || UI.defaultTradeName()).trim(),
        quantity: Math.max(1, Math.floor(Utils.safeNumber($("trade-quantity").value, 1))),
        sellPrice: Math.max(0, Utils.safeNumber($("trade-sell-price").value)),
        dividendIncome: Math.max(0, Utils.safeNumber($("trade-dividend").value)),
        targetPrice: Math.max(0, Utils.safeNumber($("trade-target").value)),
        stopPrice: Math.max(0, Utils.safeNumber($("trade-stop").value)),
        brokerageMode: $("trade-fee-mode").value,
        brokerageValue: Math.max(0, Utils.safeNumber($("trade-brokerage").value)),
        transactionRate: Utils.clamp(Math.max(0, Utils.safeNumber($("trade-charges").value)), 0, 50),
        taxRegime: $("trade-tax-regime").value,
        taxRate: Utils.clamp(Math.max(0, Utils.safeNumber($("trade-tax").value)), 0, 100),
        taxShortRate: Utils.clamp(Math.max(0, Utils.safeNumber($("trade-tax-short").value)), 0, 100),
        taxLongRate: Utils.clamp(Math.max(0, Utils.safeNumber($("trade-tax-long").value)), 0, 100),
        holdingMonths: Utils.clamp(Math.max(0, Math.floor(Utils.safeNumber($("trade-holding-months").value))), 0, 240),
        lossCarryForward: Math.max(0, Utils.safeNumber($("trade-loss-carry").value)),
        buySlippageRate: Utils.clamp(Math.max(0, Utils.safeNumber($("trade-buy-slip").value)), 0, 95),
        sellSlippageRate: Utils.clamp(Math.max(0, Utils.safeNumber($("trade-sell-slip").value)), 0, 95),
        volatilityRate: Utils.clamp(Math.max(0, Utils.safeNumber($("trade-volatility").value)), 0, 500),
        entries: UI.readEntries(),
        exits: UI.readExits()
      });
    },
    loadEditor(trade = null) {
      const active = trade ? TradeMath.normalizeTrade(trade) : TradeMath.normalizeTrade({
        name: UI.defaultTradeName(),
        quantity: 100,
        sellPrice: 120,
        targetPrice: 132,
        stopPrice: 94,
        brokerageMode: "percent",
        brokerageValue: 0.5,
        transactionRate: 0.1,
        taxRegime: "custom",
        taxRate: 15,
        taxShortRate: 30,
        taxLongRate: 15,
        holdingMonths: 6,
        buySlippageRate: 0.1,
        sellSlippageRate: 0.1,
        volatilityRate: 12,
        entries: UI.defaultEntries(),
        exits: UI.defaultExits()
      });
      state.editingId = trade ? active.id : null;
      $("trade-name").value = active.name;
      $("trade-quantity").value = active.quantity; $("trade-quantity-sl").value = active.quantity;
      $("trade-sell-price").value = active.sellPrice; $("trade-sell-price-sl").value = active.sellPrice;
      $("trade-dividend").value = active.dividendIncome; $("trade-dividend-sl").value = active.dividendIncome;
      $("trade-target").value = active.targetPrice; $("trade-target-sl").value = active.targetPrice;
      $("trade-stop").value = active.stopPrice; $("trade-stop-sl").value = active.stopPrice;
      $("trade-fee-mode").value = active.brokerageMode;
      $("trade-brokerage").value = active.brokerageValue; $("trade-brokerage-sl").value = active.brokerageValue;
      $("trade-charges").value = active.transactionRate; $("trade-charges-sl").value = active.transactionRate;
      $("trade-tax-regime").value = active.taxRegime;
      $("trade-tax").value = active.taxRate; $("trade-tax-sl").value = active.taxRate;
      $("trade-tax-short").value = active.taxShortRate;
      $("trade-tax-long").value = active.taxLongRate;
      $("trade-holding-months").value = active.holdingMonths;
      $("trade-loss-carry").value = active.lossCarryForward;
      $("trade-buy-slip").value = active.buySlippageRate; $("trade-buy-slip-sl").value = active.buySlippageRate;
      $("trade-sell-slip").value = active.sellSlippageRate; $("trade-sell-slip-sl").value = active.sellSlippageRate;
      $("trade-volatility").value = active.volatilityRate; $("trade-volatility-sl").value = active.volatilityRate;
      UI.renderEntryRows(active.entries);
      UI.renderExitRows(active.exits);
      UI.syncBrokerageMode();
      UI.syncTaxMode();
      sliderConfigs.forEach(UI.updateSliderLabel);
      $("editor-mode-pill").textContent = trade ? `Editing: ${active.name}` : "Creating New Trade";
      UI.refreshDraftStatus();
    },
    refreshDraftStatus() {
      const draft = UI.collectEditorTrade();
      const computed = TradeMath.computeTrade(draft);
      const banner = $("editor-status");
      if (!computed.valid) {
        banner.className = "status-banner error";
        banner.textContent = computed.message;
        return;
      }
      const outcomeLabel = computed.netProfit >= 0 ? "net profit" : "net loss";
      banner.className = `status-banner ${computed.netProfit > 0 ? "success" : computed.netProfit < 0 ? "error" : "warning"}`;
      banner.textContent = `${draft.name}: invested ${Utils.formatMoney(computed.totalInvestment)}, ${outcomeLabel} ${Utils.formatMoney(computed.netProfit)}, return ${Utils.formatPercent(computed.netReturnPct)}, open shares ${Utils.formatShares(computed.openQuantity)}, break-even ${Utils.formatMoney(computed.breakEven)}.${computed.warning ? ` ${computed.warning}` : ""}`;
    }
  };

  Object.assign(UI, {
    renderSelectedTradeOptions(portfolio) {
      const select = $("selected-trade");
      if (!portfolio.trades.length) {
        select.innerHTML = `<option value="">No saved trades yet</option>`;
        state.selectedTradeId = null;
        return;
      }
      if (!state.selectedTradeId || !portfolio.trades.some((trade) => trade.id === state.selectedTradeId)) {
        state.selectedTradeId = portfolio.trades[0].id;
      }
      select.innerHTML = portfolio.trades.map((trade) => `<option value="${trade.id}" ${trade.id === state.selectedTradeId ? "selected" : ""}>${Utils.escapeHtml(trade.name)}</option>`).join("");
    },
    sortTrades(trades) {
      const dir = state.sortDir === "asc" ? 1 : -1;
      const accessor = sortAccessors[state.sortKey] || sortAccessors.netProfit;
      return [...trades].sort((a, b) => {
        const aVal = accessor(a);
        const bVal = accessor(b);
        if (typeof aVal === "string" || typeof bVal === "string") return String(aVal).localeCompare(String(bVal)) * dir;
        return ((aVal > bVal) - (aVal < bVal)) * dir;
      });
    },
    renderTradeList(portfolio) {
      if (!portfolio.trades.length) {
        $("trade-list").innerHTML = `<div class="status-banner warning">No trades saved yet. Build your first trade in the editor to activate the dashboard.</div>`;
        return;
      }
      $("trade-list").innerHTML = portfolio.trades.map((trade) => `
        <div class="trade-card heat-${trade.heatTone}">
          <div class="trade-head">
            <div>
              <div class="card-title" style="font-size:1rem;margin-bottom:0.2rem;">${Utils.escapeHtml(trade.name)}</div>
              <div class="table-context">${Utils.formatShares(trade.analyzedQuantity)} | avg buy ${Utils.formatMoney(trade.averageBuyPrice)} | open ${Utils.formatShares(trade.openQuantity)} | staged exits ${trade.realizedExits.length}</div>
            </div>
            <div class="quality-badge ${trade.quality.tone}">${trade.quality.label}</div>
          </div>
          <div class="badge-strip">
            <span class="heat-pill ${trade.heatTone === "good" ? "safe" : trade.heatTone === "warn" ? "warn" : "danger"}">${trade.heatTone === "good" ? "Efficient" : trade.heatTone === "warn" ? "Watch Risk" : "High Risk"}</span>
            <span class="heat-pill ${Number.isFinite(trade.positionRiskPct) && trade.positionRiskPct <= 8 ? "safe" : Number.isFinite(trade.positionRiskPct) && trade.positionRiskPct <= 15 ? "warn" : Number.isFinite(trade.positionRiskPct) ? "danger" : "warn"}">${Number.isFinite(trade.positionRiskPct) ? `Risk ${Utils.formatPercent(trade.positionRiskPct)}` : "No Stop Set"}</span>
            <span class="heat-pill ${trade.feeImpactPct <= 1 ? "safe" : trade.feeImpactPct <= 2 ? "warn" : "danger"}">Fee drag ${Utils.formatPercent(trade.feeImpactPct)}</span>
          </div>
          <div class="trade-mini-grid">
            <div class="trade-mini"><strong>Net Result</strong><span>${Utils.formatMoney(trade.netProfit)}</span></div>
            <div class="trade-mini"><strong>Net Return</strong><span>${Utils.formatPercent(trade.netReturnPct)}</span></div>
            <div class="trade-mini"><strong>Break-even</strong><span>${Utils.formatMoney(trade.breakEven)}</span></div>
            <div class="trade-mini"><strong>Allocation</strong><span>${Utils.formatPercent(trade.allocationPct)}</span></div>
            <div class="trade-mini"><strong>Risk-Reward</strong><span>${Utils.formatRatio(trade.riskReward)}</span></div>
            <div class="trade-mini"><strong>After-Tax Value</strong><span>${Utils.formatMoney(trade.afterTaxValue)}</span></div>
          </div>
          <div class="trade-actions" style="margin-top:0.85rem;">
            <button type="button" class="micro-btn" data-trade-action="edit" data-id="${trade.id}">Edit</button>
            <button type="button" class="micro-btn" data-trade-action="duplicate" data-id="${trade.id}">Duplicate</button>
            <button type="button" class="micro-btn danger" data-trade-action="delete" data-id="${trade.id}">Delete</button>
          </div>
        </div>
      `).join("");
    },
    renderComparison(portfolio) {
      if (!portfolio.trades.length) {
        $("comparison-body").innerHTML = `<tr><td colspan="11">Save trades to unlock the comparison engine.</td></tr>`;
        return;
      }
      $("comparison-body").innerHTML = UI.sortTrades(portfolio.trades).map((trade) => `
        <tr class="comparison-row heat-${trade.heatTone}">
          <td>${Utils.escapeHtml(trade.name)}</td>
          <td>${Utils.formatMoney(trade.totalInvestment)}</td>
          <td>${Utils.formatMoney(trade.afterTaxValue)}</td>
          <td>${Utils.formatMoney(trade.netProfit)}</td>
          <td>${Utils.formatPercent(trade.netReturnPct)}</td>
          <td>${Utils.formatMoney(trade.breakEven)}</td>
          <td>${Utils.formatRatio(trade.riskReward)}</td>
          <td>${Utils.formatPercent(trade.positionRiskPct)}</td>
          <td>${Utils.formatPercent(trade.feeImpactPct)}</td>
          <td>${Math.round(trade.quality.score)} / 100</td>
          <td>${Utils.formatPercent(trade.allocationPct)}</td>
        </tr>
      `).join("");
    },
    renderScenarioTable(portfolio) {
      if (!portfolio.trades.length) {
        $("scenario-body").innerHTML = `<tr><td colspan="5">Save a trade to activate scenario analysis.</td></tr>`;
        $("scenario-context").textContent = "Choose a trade in the workspace controls to review its scenario path.";
        return;
      }
      const selected = portfolio.trades.find((trade) => trade.id === state.selectedTradeId) || portfolio.trades[0];
      state.selectedTradeId = selected.id;
      $("scenario-context").textContent = `Scenario map for ${selected.name}. Open shares: ${Utils.formatShares(selected.openQuantity)}. Volatility assumption: ${Utils.formatPercent(selected.raw.volatilityRate)}.`;
      $("scenario-body").innerHTML = selected.scenarios.map((scenario) => `
        <tr>
          <td>${scenario.label}</td>
          <td>${Utils.formatMoney(scenario.quotedSellPrice)}</td>
          <td>${Utils.formatMoney(scenario.actualSellPrice)}</td>
          <td>${Utils.formatMoney(scenario.netProfit)}</td>
          <td>${Utils.formatPercent(scenario.netReturnPct)}</td>
        </tr>
      `).join("");
    },
    updateAlerts(portfolio, mcResult) {
      const allocTone = portfolio.maxAllocation > 45 ? "danger" : portfolio.maxAllocation > 30 ? "warn" : "safe";
      const riskTone = portfolio.portfolioRiskExposure > 12 ? "danger" : portfolio.portfolioRiskExposure > 7 ? "warn" : "safe";
      const costTone = portfolio.avgFeeDrag > 2 ? "danger" : portfolio.avgFeeDrag > 1 ? "warn" : "safe";
      const alertConfigs = [
        {
          id: "alert-0",
          tone: allocTone,
          title: "Allocation alert",
          text: portfolio.trades.length ? `Largest capital concentration is ${Utils.formatPercent(portfolio.maxAllocation)}. High concentration means one trade can dominate the full dashboard result.` : "Portfolio concentration updates after every saved trade."
        },
        {
          id: "alert-1",
          tone: riskTone,
          title: "Risk alert",
          text: portfolio.trades.length ? `Portfolio risk exposure is ${Utils.formatPercent(portfolio.portfolioRiskExposure)}${mcResult ? ` and Monte Carlo stress drawdown is ${Utils.formatPercent(mcResult.stressDrawdownPct)}.` : "."}` : "Stop-loss distance and exposure badges help flag trades that carry too much downside."
        },
        {
          id: "alert-2",
          tone: costTone,
          title: "Cost alert",
          text: portfolio.trades.length ? `Average fee drag is ${Utils.formatPercent(portfolio.avgFeeDrag)} and tax-aware liquidation is built into every trade.` : "Fee drag and tax treatment are monitored across the full portfolio."
        }
      ];
      alertConfigs.forEach((config) => {
        const node = $(config.id);
        node.className = `alert-box ${config.tone}`;
        node.innerHTML = `<strong>${config.title}</strong>${config.text}`;
      });
    }
  });

  Object.assign(UI, {
    renderPortfolioStats(portfolio, mcResult) {
      $("portfolio-pill").textContent = portfolio.trades.length ? `${portfolio.trades.length} Trades Live` : "No Trades Yet";
      $("metric-trades").textContent = String(portfolio.trades.length);
      $("metric-invested").textContent = Utils.formatMoney(portfolio.totalInvested);
      $("metric-sell-value").textContent = Utils.formatMoney(portfolio.totalAfterTaxValue);
      $("metric-profit").textContent = Utils.formatMoney(portfolio.totalProfit);
      $("metric-return").textContent = Utils.formatPercent(portfolio.overallReturnPct);
      $("metric-risk-exposure").textContent = Utils.formatPercent(portfolio.portfolioRiskExposure);
      $("metric-rr").textContent = Utils.formatRatio(portfolio.avgRiskReward);
      $("metric-sharpe").textContent = Number.isFinite(mcResult?.volatilityPct) && mcResult.volatilityPct > 0
        ? (portfolio.overallReturnPct / mcResult.volatilityPct).toFixed(2)
        : (Number.isFinite(portfolio.sharpeLike) ? portfolio.sharpeLike.toFixed(2) : "N/A");
      $("metric-drawdown").textContent = Utils.formatPercent(mcResult ? mcResult.stressDrawdownPct : portfolio.maxDrawdownEstimatePct);
      $("metric-concentration").textContent = Utils.formatPercent(portfolio.maxAllocation);
      $("metric-worst-loss").textContent = Utils.formatMoney(portfolio.worstCaseLoss);
      $("metric-quality").textContent = `${Math.round(portfolio.qualityScore)} / 100`;
      $("portfolio-quality-score").innerHTML = `${Math.round(portfolio.qualityScore)}<small>/ 100</small>`;
      $("portfolio-quality-badge").className = `quality-badge ${portfolio.quality.tone}`;
      $("portfolio-quality-badge").textContent = portfolio.quality.label;
      $("portfolio-quality-fill").style.width = `${Math.round(portfolio.qualityScore)}%`;

      const profitableCount = portfolio.trades.filter((trade) => trade.netProfit > 0).length;
      $("quality-line-0").textContent = portfolio.trades.length ? `${profitableCount} of ${portfolio.trades.length} trades are profitable` : "No portfolio loaded yet";
      $("quality-sub-0").textContent = portfolio.trades.length ? `Portfolio net result is ${Utils.formatMoney(portfolio.totalProfit)} on ${Utils.formatMoney(portfolio.totalInvested)} invested.` : "Save trades to activate comparison, allocation, and risk analytics.";
      $("quality-line-1").textContent = Number.isFinite(portfolio.avgRiskReward) ? `Average valid risk-reward is ${Utils.formatRatio(portfolio.avgRiskReward)}` : "Risk dashboard pending";
      $("quality-sub-1").textContent = Number.isFinite(portfolio.avgRiskReward) ? `Portfolio risk exposure is ${Utils.formatPercent(portfolio.portfolioRiskExposure)} and the platform weights larger trades more heavily.` : "Add valid target and stop-loss levels to measure trade planning quality.";
      $("quality-line-2").textContent = portfolio.trades.length ? `Largest capital concentration is ${Utils.formatPercent(portfolio.maxAllocation)}` : "Allocation is balanced";
      $("quality-sub-2").textContent = "High concentration can make one trade dominate the portfolio outcome.";
      if (mcResult) {
        $("quality-line-3").textContent = `Monte Carlo median value is ${Utils.formatMoney(mcResult.p50)}`;
        $("quality-sub-3").textContent = `Simulation outcomes range from ${Utils.formatMoney(mcResult.p10)} to ${Utils.formatMoney(mcResult.p90)} with ${Utils.formatPercent(mcResult.profitProbabilityPct)} profit probability.`;
      } else if (portfolio.trades.length) {
        const bestScenario = portfolio.scenarioTotals.reduce((best, item) => item.netProfit > best.netProfit ? item : best, { label: "N/A", netProfit: 0 });
        const worstScenario = portfolio.scenarioTotals.reduce((worst, item) => item.netProfit < worst.netProfit ? item : worst, { label: "N/A", netProfit: 0 });
        $("quality-line-3").textContent = `${bestScenario.label} is the strongest portfolio scenario`;
        $("quality-sub-3").textContent = `Scenario outcomes range from ${Utils.formatMoney(worstScenario.netProfit)} to ${Utils.formatMoney(bestScenario.netProfit)}.`;
      } else {
        $("quality-line-3").textContent = "Scenario resilience pending";
        $("quality-sub-3").textContent = "Scenario analytics measure how sensitive the portfolio is to exit assumptions.";
      }

      $("risk-sub-0").textContent = Utils.formatMoney(portfolio.totalInvested);
      $("risk-sub-1").textContent = Utils.formatPercent(portfolio.portfolioRiskExposure);
      $("risk-sub-2").textContent = Utils.formatRatio(portfolio.avgRiskReward);
      $("risk-sub-3").textContent = Utils.formatMoney(portfolio.worstCaseLoss);
      $("risk-sub-4").textContent = Utils.formatPercent(portfolio.avgFeeDrag);
      $("risk-sub-5").textContent = Number.isFinite(mcResult?.volatilityPct) && mcResult.volatilityPct > 0
        ? (portfolio.overallReturnPct / mcResult.volatilityPct).toFixed(2)
        : (Number.isFinite(portfolio.sharpeLike) ? portfolio.sharpeLike.toFixed(2) : "N/A");

      if (!portfolio.trades.length) {
        $("portfolio-insight").textContent = "The unified trading dashboard becomes most useful once you save at least two trades and start comparing efficiency, allocation, and risk together.";
      } else {
        const topTrade = portfolio.topTrade ? `${portfolio.topTrade.name} at ${Utils.formatMoney(portfolio.topTrade.netProfit)}` : "none yet";
        $("portfolio-insight").textContent = `The portfolio currently holds ${portfolio.trades.length} trades with ${Utils.formatMoney(portfolio.totalInvested)} invested and ${Utils.formatMoney(portfolio.totalProfit)} net result. The strongest contributor is ${topTrade}, while the largest capital concentration sits at ${Utils.formatPercent(portfolio.maxAllocation)}.`;
      }

      UI.updateAlerts(portfolio, mcResult);
    },
    renderMonteCarlo(portfolio, mcResult) {
      if (!state.mcEnabled || !portfolio.trades.length || !mcResult) {
        $("mc-pill").textContent = state.mcEnabled ? "Monte Carlo Ready" : "Monte Carlo Off";
        $("mc-p10").textContent = "N/A";
        $("mc-p50").textContent = "N/A";
        $("mc-p90").textContent = "N/A";
        $("mc-profit-prob").textContent = "N/A";
        $("mc-loss-prob").textContent = "N/A";
        $("mc-volatility").textContent = "N/A";
        $("mc-dd-avg").textContent = "N/A";
        $("mc-dd-worst").textContent = "N/A";
        $("mc-insight").textContent = "Enable Monte Carlo and save a few trades to see percentile ranges, profit probability, and drawdown estimates for the full portfolio.";
        return;
      }
      $("mc-pill").textContent = `${mcResult.runs} Simulations`;
      $("mc-p10").textContent = Utils.formatMoney(mcResult.p10);
      $("mc-p50").textContent = Utils.formatMoney(mcResult.p50);
      $("mc-p90").textContent = Utils.formatMoney(mcResult.p90);
      $("mc-profit-prob").textContent = Utils.formatPercent(mcResult.profitProbabilityPct);
      $("mc-loss-prob").textContent = Utils.formatPercent(mcResult.lossProbabilityPct);
      $("mc-volatility").textContent = Utils.formatPercent(mcResult.volatilityPct);
      $("mc-dd-avg").textContent = Utils.formatPercent(mcResult.avgDrawdownPct);
      $("mc-dd-worst").textContent = Utils.formatPercent(mcResult.stressDrawdownPct);
      $("mc-insight").textContent = `Monte Carlo shows a median liquidation value of ${Utils.formatMoney(mcResult.p50)} with ${Utils.formatPercent(mcResult.profitProbabilityPct)} odds of finishing above invested capital across ${mcResult.runs} simulated runs.`;
    },
    buildAxisBounds(values) {
      const finite = values.filter((value) => Number.isFinite(value));
      if (!finite.length) return { suggestedMin: -1, suggestedMax: 1 };
      let min = Math.min(...finite, 0);
      let max = Math.max(...finite, 0);
      if (min === max) {
        const pad = Math.abs(min || 1) * 0.25 + 1;
        min -= pad;
        max += pad;
      }
      const span = max - min;
      const pad = span * 0.12;
      return { suggestedMin: min - pad, suggestedMax: max + pad };
    },
    destroyChart(key) {
      if (state.charts[key]) {
        state.charts[key].destroy();
        state.charts[key] = null;
      }
    },
    renderCharts(portfolio, mcResult) {
      if (!window.Chart) return;
      ["profit", "allocation", "timeline", "scenario", "mc"].forEach(UI.destroyChart);
      if (!portfolio.trades.length) return;

      const profitAxis = UI.buildAxisBounds(portfolio.trades.map((trade) => trade.netProfit));
      state.charts.profit = new Chart($("profit-chart"), {
        type: "bar",
        data: {
          labels: portfolio.trades.map((trade) => trade.name),
          datasets: [{
            label: "Net Profit / Loss",
            data: portfolio.trades.map((trade) => trade.netProfit),
            backgroundColor: portfolio.trades.map((trade) => trade.netProfit >= 0 ? "#0d9488" : "#f43f5e"),
            borderRadius: 10
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { suggestedMin: profitAxis.suggestedMin, suggestedMax: profitAxis.suggestedMax, ticks: { callback(value) { return Utils.formatMoney(value); } } } }
        }
      });

      state.charts.allocation = new Chart($("allocation-chart"), {
        type: "doughnut",
        data: {
          labels: portfolio.trades.map((trade) => trade.name),
          datasets: [{ data: portfolio.trades.map((trade) => trade.totalInvestment), backgroundColor: ["#0d9488", "#0284c7", "#f59e0b", "#a855f7", "#f43f5e", "#14b8a6", "#1d4ed8", "#84cc16"] }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }
      });

      state.charts.timeline = new Chart($("timeline-chart"), {
        type: "line",
        data: {
          labels: portfolio.timeline.map((point) => point.label),
          datasets: [
            { label: "Cumulative Invested", data: portfolio.timeline.map((point) => point.invested), borderColor: "#0284c7", backgroundColor: "rgba(2, 132, 199, 0.12)", tension: 0.22, fill: false },
            { label: "Cumulative Portfolio Value", data: portfolio.timeline.map((point) => point.value), borderColor: "#0d9488", backgroundColor: "rgba(13, 148, 136, 0.12)", tension: 0.22, fill: false },
            { label: "Cumulative Net Profit", data: portfolio.timeline.map((point) => point.profit), borderColor: "#f59e0b", backgroundColor: "rgba(245, 158, 11, 0.14)", tension: 0.22, fill: false }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } }, scales: { y: { ticks: { callback(value) { return Utils.formatMoney(value); } } } } }
      });

      const scenarioAxis = UI.buildAxisBounds(portfolio.scenarioTotals.map((item) => item.netProfit));
      state.charts.scenario = new Chart($("scenario-chart"), {
        type: "bar",
        data: { labels: portfolio.scenarioTotals.map((item) => item.label), datasets: [{ label: "Portfolio Net Profit / Loss", data: portfolio.scenarioTotals.map((item) => item.netProfit), backgroundColor: portfolio.scenarioTotals.map((item) => item.netProfit >= 0 ? "#10b981" : "#fb7185"), borderRadius: 10 }] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { suggestedMin: scenarioAxis.suggestedMin, suggestedMax: scenarioAxis.suggestedMax, ticks: { callback(value) { return Utils.formatMoney(value); } } } }
        }
      });

      if (mcResult) {
        state.charts.mc = new Chart($("mc-chart"), {
          type: "line",
          data: {
            labels: mcResult.labels,
            datasets: [
              { label: "P90", data: mcResult.p90Path, borderColor: "rgba(13, 148, 136, 0.55)", backgroundColor: "rgba(13, 148, 136, 0.14)", pointRadius: 0, tension: 0.22, fill: false },
              { label: "P10", data: mcResult.p10Path, borderColor: "rgba(244, 63, 94, 0.45)", backgroundColor: "rgba(2, 132, 199, 0.12)", pointRadius: 0, tension: 0.22, fill: "-1" },
              { label: "P50 Median", data: mcResult.p50Path, borderColor: "#0284c7", backgroundColor: "rgba(2, 132, 199, 0.14)", pointRadius: 0, tension: 0.22, fill: false, borderWidth: 2.5 }
            ]
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } }, scales: { y: { ticks: { callback(value) { return Utils.formatMoney(value); } } } } }
        });
      }
    },
    copyPortfolioSummary(portfolio, mcResult) {
      return [
        "Unified Trading Dashboard",
        `Trades: ${portfolio.trades.length}`,
        `Total invested: ${Utils.formatMoney(portfolio.totalInvested)}`,
        `After-tax liquidation value: ${Utils.formatMoney(portfolio.totalAfterTaxValue)}`,
        `Total net profit: ${Utils.formatMoney(portfolio.totalProfit)}`,
        `Overall return: ${Utils.formatPercent(portfolio.overallReturnPct)}`,
        `Portfolio risk exposure: ${Utils.formatPercent(portfolio.portfolioRiskExposure)}`,
        `Average risk-reward: ${Utils.formatRatio(portfolio.avgRiskReward)}`,
        `Capital concentration: ${Utils.formatPercent(portfolio.maxAllocation)}`,
        `Portfolio quality: ${Math.round(portfolio.qualityScore)} / 100 (${portfolio.quality.label})`,
        mcResult ? `Monte Carlo median: ${Utils.formatMoney(mcResult.p50)} | Profit probability: ${Utils.formatPercent(mcResult.profitProbabilityPct)}` : "Monte Carlo: disabled"
      ].join("\n");
    },
    exportCsv(portfolio) {
      if (!state.trades.length) return;
      const rows = state.trades.map((trade, index) => {
        const normalized = TradeMath.normalizeTrade(trade, index);
        const computed = portfolio.trades.find((item) => item.id === normalized.id);
        return {
          name: normalized.name,
          quantity: normalized.quantity,
          sellPrice: normalized.sellPrice,
          dividendIncome: normalized.dividendIncome,
          targetPrice: normalized.targetPrice,
          stopPrice: normalized.stopPrice,
          brokerageMode: normalized.brokerageMode,
          brokerageValue: normalized.brokerageValue,
          transactionRate: normalized.transactionRate,
          taxRegime: normalized.taxRegime,
          taxRate: normalized.taxRate,
          taxShortRate: normalized.taxShortRate,
          taxLongRate: normalized.taxLongRate,
          holdingMonths: normalized.holdingMonths,
          lossCarryForward: normalized.lossCarryForward,
          buySlippageRate: normalized.buySlippageRate,
          sellSlippageRate: normalized.sellSlippageRate,
          volatilityRate: normalized.volatilityRate,
          entriesJson: JSON.stringify(normalized.entries),
          exitsJson: JSON.stringify(normalized.exits),
          netProfit: computed ? computed.netProfit.toFixed(2) : "",
          netReturnPct: computed ? computed.netReturnPct.toFixed(2) : ""
        };
      });
      const headers = Object.keys(rows[0]);
      const lines = [headers.join(",")];
      rows.forEach((row) => {
        lines.push(headers.map((header) => `"${String(row[header]).replace(/"/g, '""')}"`).join(","));
      });
      Utils.downloadTextFile(lines.join("\n"), "unified_trading_dashboard.csv", "text/csv;charset=utf-8;");
    },
    importCsvText(text) {
      const rows = Utils.parseCsv(text);
      if (rows.length < 2) throw new Error("CSV file is empty.");
      const headers = rows[0].map((header) => header.trim());
      const imported = rows.slice(1).map((row, index) => {
        const record = {};
        headers.forEach((header, col) => { record[header] = row[col] ?? ""; });
        const entries = record.entriesJson ? JSON.parse(record.entriesJson) : [{ price: Utils.safeNumber(record.buyPrice, 100), quantity: Utils.safeNumber(record.buyQuantity, 100) }];
        const exits = record.exitsJson ? JSON.parse(record.exitsJson) : [];
        return TradeMath.normalizeTrade({
          id: Utils.uid(),
          name: record.name || `Imported Trade ${index + 1}`,
          quantity: Utils.safeNumber(record.quantity, 100),
          sellPrice: Utils.safeNumber(record.sellPrice, 120),
          dividendIncome: Utils.safeNumber(record.dividendIncome, 0),
          targetPrice: Utils.safeNumber(record.targetPrice, 132),
          stopPrice: Utils.safeNumber(record.stopPrice, 94),
          brokerageMode: record.brokerageMode || "percent",
          brokerageValue: Utils.safeNumber(record.brokerageValue, 0.5),
          transactionRate: Utils.safeNumber(record.transactionRate, 0.1),
          taxRegime: record.taxRegime || "custom",
          taxRate: Utils.safeNumber(record.taxRate, 15),
          taxShortRate: Utils.safeNumber(record.taxShortRate, 30),
          taxLongRate: Utils.safeNumber(record.taxLongRate, 15),
          holdingMonths: Utils.safeNumber(record.holdingMonths, 6),
          lossCarryForward: Utils.safeNumber(record.lossCarryForward, 0),
          buySlippageRate: Utils.safeNumber(record.buySlippageRate, 0.1),
          sellSlippageRate: Utils.safeNumber(record.sellSlippageRate, 0.1),
          volatilityRate: Utils.safeNumber(record.volatilityRate, 12),
          entries,
          exits
        });
      }).filter((trade) => trade.entries.length);
      if (!imported.length) throw new Error("No valid trades were found in the CSV file.");
      state.trades = imported;
      state.selectedTradeId = imported[0].id;
      UI.loadEditor(null);
      App.scheduleRender(true);
      UI.setCopyNote(`${imported.length} trades imported.`);
    },
    renderAll() {
      const portfolio = TradeMath.computePortfolio(state.trades);
      const mcResult = TradeMath.computeMonteCarlo(portfolio);
      UI.applyUiState();
      UI.syncCurrencyIndicators();
      sliderConfigs.forEach(UI.updateSliderLabel);
      UI.renderSelectedTradeOptions(portfolio);
      UI.renderTradeList(portfolio);
      UI.renderPortfolioStats(portfolio, mcResult);
      UI.renderMonteCarlo(portfolio, mcResult);
      UI.renderComparison(portfolio);
      UI.renderScenarioTable(portfolio);
      UI.renderCharts(portfolio, mcResult);
      Persistence.saveLocalState();
      return { portfolio, mcResult };
    }
  });

  const App = {
    scheduleRender(immediate = false) {
      clearTimeout(state.renderTimer);
      const run = () => UI.renderAll();
      if (immediate) {
        run();
      } else {
        state.renderTimer = window.setTimeout(run, 100);
      }
    }
  };

  function addEntryRow(price = 100, quantity = 25) {
    const entries = UI.readEntries();
    entries.push(TradeMath.defaultEntry(price, quantity));
    UI.renderEntryRows(entries);
    UI.refreshDraftStatus();
  }

  function addExitRow(price = Utils.safeNumber($("trade-sell-price").value, 120), quantity = 25, extraFee = 0) {
    const exits = UI.readExits();
    exits.push(TradeMath.defaultExit(price, quantity, extraFee));
    UI.renderExitRows(exits);
    UI.refreshDraftStatus();
  }

  function saveTrade() {
    const draft = UI.collectEditorTrade();
    const computed = TradeMath.computeTrade(draft);
    if (!computed.valid) {
      $("editor-status").className = "status-banner error";
      $("editor-status").textContent = computed.message;
      return;
    }
    const existingIndex = state.trades.findIndex((trade) => trade.id === draft.id);
    if (existingIndex >= 0) state.trades[existingIndex] = draft;
    else state.trades.push(draft);
    state.selectedTradeId = draft.id;
    UI.loadEditor(null);
    App.scheduleRender(true);
    $("editor-status").className = "status-banner success";
    $("editor-status").textContent = `${draft.name} saved to the dashboard.${computed.warning ? ` ${computed.warning}` : ""}`;
  }

  function duplicateTrade(id) {
    const existing = state.trades.find((trade) => trade.id === id);
    if (!existing) return;
    const clone = TradeMath.normalizeTrade({
      ...existing,
      id: Utils.uid(),
      name: `${existing.name} Copy`,
      entries: existing.entries.map((entry) => ({ ...entry })),
      exits: (existing.exits || []).map((exit) => ({ ...exit }))
    });
    state.trades.push(clone);
    state.selectedTradeId = clone.id;
    App.scheduleRender();
  }

  function deleteTrade(id) {
    state.trades = state.trades.filter((trade) => trade.id !== id);
    if (state.editingId === id) UI.loadEditor(null);
    App.scheduleRender();
  }

  function editTrade(id) {
    const trade = state.trades.find((item) => item.id === id);
    if (trade) UI.loadEditor(trade);
  }

  function clearPortfolio() {
    state.trades = [];
    state.selectedTradeId = null;
    state.editingId = null;
    UI.loadEditor(null);
    App.scheduleRender(true);
  }

  function loadSamplePortfolio() {
    state.trades = UI.samplePortfolio();
    state.selectedTradeId = state.trades[0]?.id || null;
    UI.loadEditor(null);
    App.scheduleRender(true);
  }

  function updateRowValue(row, type) {
    if (!row) return;
    const price = Utils.safeNumber(row.querySelector(type === "entry" ? ".entry-price" : ".exit-price")?.value);
    const quantity = Utils.safeNumber(row.querySelector(type === "entry" ? ".entry-qty" : ".exit-qty")?.value);
    const valueNode = row.querySelector(".slider-lbl");
    if (valueNode) valueNode.textContent = Utils.formatMoney(price * quantity);
  }

  function bindEvents() {
    UI.bindSliderPairs();

    $("dash-currency").addEventListener("change", () => {
      state.currency = $("dash-currency").value;
      App.scheduleRender(true);
      UI.refreshDraftStatus();
    });
    $("selected-trade").addEventListener("change", () => {
      state.selectedTradeId = $("selected-trade").value || null;
      App.scheduleRender(true);
    });
    $("trade-fee-mode").addEventListener("change", () => {
      UI.syncBrokerageMode();
      UI.refreshDraftStatus();
    });
    $("trade-tax-regime").addEventListener("change", () => {
      UI.syncTaxMode();
      UI.refreshDraftStatus();
    });
    $("mc-enabled").addEventListener("change", () => {
      state.mcEnabled = $("mc-enabled").checked;
      App.scheduleRender();
    });
    $("mc-runs").addEventListener("input", () => {
      state.mcRuns = Utils.clamp(Utils.safeNumber($("mc-runs").value, 500), 100, 2000);
      App.scheduleRender();
    });
    $("mc-steps").addEventListener("input", () => {
      state.mcSteps = Utils.clamp(Utils.safeNumber($("mc-steps").value, 24), 6, 60);
      App.scheduleRender();
    });
    $("mc-seed").addEventListener("input", () => {
      state.mcSeed = $("mc-seed").value || "SCW-INTEL";
      App.scheduleRender();
    });

    $("ui-mode-beginner").addEventListener("click", () => {
      state.uiMode = "beginner";
      UI.applyUiState();
      Persistence.saveLocalState();
    });
    $("ui-mode-advanced").addEventListener("click", () => {
      state.uiMode = "advanced";
      UI.applyUiState();
      Persistence.saveLocalState();
    });
    $("theme-light").addEventListener("click", () => {
      state.theme = "light";
      UI.applyUiState();
      Persistence.saveLocalState();
    });
    $("theme-dark").addEventListener("click", () => {
      state.theme = "dark";
      UI.applyUiState();
      Persistence.saveLocalState();
    });

    $$("#trade-builder input, #trade-builder select").forEach((node) => {
      if (!node.matches('input[type="range"]') && !["mc-enabled", "mc-runs", "mc-steps", "mc-seed"].includes(node.id)) {
        node.addEventListener("input", () => UI.refreshDraftStatus());
      }
    });

    $("add-entry-btn").addEventListener("click", () => addEntryRow(100, 25));
    $("reset-entries-btn").addEventListener("click", () => {
      UI.renderEntryRows(UI.defaultEntries());
      UI.refreshDraftStatus();
    });
    $("add-exit-btn").addEventListener("click", () => addExitRow());
    $("reset-exits-btn").addEventListener("click", () => {
      UI.renderExitRows(UI.defaultExits());
      UI.refreshDraftStatus();
    });

    $("save-trade-btn").addEventListener("click", saveTrade);
    $("reset-editor-btn").addEventListener("click", () => UI.loadEditor(null));
    $("sample-portfolio-btn").addEventListener("click", loadSamplePortfolio);
    $("clear-portfolio-btn").addEventListener("click", clearPortfolio);
    $("download-csv-btn").addEventListener("click", () => UI.exportCsv(TradeMath.computePortfolio(state.trades)));

    $("copy-summary-btn").addEventListener("click", () => {
      const portfolio = TradeMath.computePortfolio(state.trades);
      const mcResult = TradeMath.computeMonteCarlo(portfolio);
      const text = UI.copyPortfolioSummary(portfolio, mcResult);
      if (!navigator.clipboard?.writeText) {
        UI.setCopyNote("Copy is not available in this browser.");
        return;
      }
      navigator.clipboard.writeText(text).then(() => UI.setCopyNote("Portfolio summary copied.")).catch(() => UI.setCopyNote("Copy failed in this browser."));
    });

    $("share-url-btn").addEventListener("click", () => {
      Persistence.saveUrlState();
      if (!navigator.clipboard?.writeText) {
        UI.setCopyNote("Copy is not available in this browser.");
        return;
      }
      navigator.clipboard.writeText(location.href).then(() => UI.setCopyNote("Shareable URL copied.")).catch(() => UI.setCopyNote("Copy failed in this browser."));
    });

    $("import-csv-btn").addEventListener("click", () => $("import-csv-input").click());
    $("import-csv-input").addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        UI.importCsvText(text);
      } catch (error) {
        UI.setCopyNote(error.message || "CSV import failed.");
      } finally {
        event.target.value = "";
      }
    });

    $("entry-list").addEventListener("click", (event) => {
      const button = event.target.closest("[data-entry-action]");
      if (!button) return;
      const row = button.closest(".entry-row");
      if (row) row.remove();
      if (!$$("#entry-list .entry-row").length) UI.renderEntryRows([TradeMath.defaultEntry(100, 100)]);
      UI.refreshDraftStatus();
    });
    $("entry-list").addEventListener("input", (event) => {
      updateRowValue(event.target.closest(".entry-row"), "entry");
      UI.refreshDraftStatus();
    });

    $("exit-list").addEventListener("click", (event) => {
      const button = event.target.closest("[data-exit-action]");
      if (!button) return;
      const row = button.closest(".exit-row");
      if (row) row.remove();
      if (!$$("#exit-list .exit-row").length) UI.renderExitRows([]);
      UI.refreshDraftStatus();
    });
    $("exit-list").addEventListener("input", (event) => {
      updateRowValue(event.target.closest(".exit-row"), "exit");
      UI.refreshDraftStatus();
    });

    $("trade-list").addEventListener("click", (event) => {
      const button = event.target.closest("[data-trade-action]");
      if (!button) return;
      const id = button.dataset.id;
      if (button.dataset.tradeAction === "edit") editTrade(id);
      if (button.dataset.tradeAction === "duplicate") duplicateTrade(id);
      if (button.dataset.tradeAction === "delete") deleteTrade(id);
    });

    $$(".sort-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const nextKey = button.dataset.sort;
        if (state.sortKey === nextKey) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        else {
          state.sortKey = nextKey;
          state.sortDir = nextKey === "name" ? "asc" : "desc";
        }
        App.scheduleRender(true);
      });
    });
  }

  function initMobileNav() {
    const btn = $("hamburgerBtn");
    const nav = $("mobileNav");
    btn.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  function init() {
    initMobileNav();
    const hasUrlState = Persistence.loadUrlState();
    if (!hasUrlState) Persistence.loadLocalState();
    $("dash-currency").value = state.currency;
    $("mc-enabled").checked = state.mcEnabled;
    $("mc-runs").value = state.mcRuns;
    $("mc-steps").value = state.mcSteps;
    $("mc-seed").value = state.mcSeed;
    UI.applyUiState();
    UI.renderEntryRows(UI.defaultEntries());
    UI.renderExitRows(UI.defaultExits());
    UI.loadEditor(null);
    bindEvents();
    App.scheduleRender(true);
  }

  window.addEventListener("DOMContentLoaded", init);
})();