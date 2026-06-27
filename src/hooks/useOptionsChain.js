import { useCallback, useEffect, useRef, useState } from 'react';
import { generateOptionsChain } from '../lib/blackScholes';
import {
  fetchExpiryEodPrices,
  fetchOptionExpiries,
  getOptionsChainErrorMessage,
  getOptionsChainSourceLabel,
} from '../marketData/massiveOptions';

/**
 * Massive options chain — expiries first, price on expiry click (Options Basic).
 */
export function useOptionsChain(symbol, underlyingPrice, sigma) {
  const [state, setState] = useState({
    chains: [],
    expiries: [],
    source: 'loading',
    message: '',
    pricingExpiry: null,
  });

  const contractsRef = useRef(null);
  const pricedExpiriesRef = useRef(new Set());
  const sourceRef = useRef('loading');

  useEffect(() => {
    const upper = symbol?.toUpperCase();
    if (!upper) return undefined;

    let cancelled = false;
    contractsRef.current = null;
    pricedExpiriesRef.current = new Set();

    async function load() {
      setState({
        chains: [],
        expiries: [],
        source: 'loading',
        message: '',
        pricingExpiry: null,
      });

      try {
        const result = await fetchOptionExpiries(upper, underlyingPrice || 0);
        if (cancelled) return;

        contractsRef.current = result.contracts;
        result.chains.forEach((c) => pricedExpiriesRef.current.add(c.expiry));

        setState({
          chains: result.chains,
          expiries: result.expiries,
          source: 'eod',
          message: result.fromCache ? 'Some expiries restored from cache.' : '',
          pricingExpiry: null,
        });
        sourceRef.current = 'eod';
      } catch (error) {
        if (cancelled) return;
        const model = generateOptionsChain(upper, underlyingPrice || 100, sigma);
        setState({
          chains: model,
          expiries: model.map((c) => c.expiry),
          source: 'model',
          message: getOptionsChainErrorMessage(error),
          pricingExpiry: null,
        });
        sourceRef.current = 'model';
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [symbol, underlyingPrice, sigma]);

  const loadExpiry = useCallback(async (expiry) => {
    if (!expiry || sourceRef.current !== 'eod') return;
    if (pricedExpiriesRef.current.has(expiry)) return;

    setState((prev) => ({
      ...prev,
      pricingExpiry: expiry,
      message: getOptionsChainSourceLabel(true),
    }));

    try {
      await fetchExpiryEodPrices(
        symbol,
        expiry,
        underlyingPrice || 0,
        contractsRef.current,
        (partialChain) => {
          setState((prev) => {
            const merged = new Map(prev.chains.map((c) => [c.expiry, c]));
            merged.set(partialChain.expiry, partialChain);
            return {
              ...prev,
              chains: [...merged.values()].sort((a, b) => a.expiry.localeCompare(b.expiry)),
            };
          });
        },
      );

      pricedExpiriesRef.current.add(expiry);

      setState((prev) => ({
        ...prev,
        pricingExpiry: null,
        message: '',
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        pricingExpiry: null,
        message: getOptionsChainErrorMessage(new Error('empty_chain')),
      }));
    }
  }, [symbol, underlyingPrice]);

  return { ...state, loadExpiry };
}
