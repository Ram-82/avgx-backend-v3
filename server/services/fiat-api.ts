import { FileManager } from '../utils/file-manager';
import { withRetry } from '../utils/retry';

interface FiatConfig {
  code: string;
  name: string;
  weight: number;
}

interface FiatData extends FiatConfig {
  rate: number;
}

interface ExchangeRateResponse {
  base: string;
  date: string;
  rates: { [key: string]: number };
}

class FiatApiService {
  private cachedRates: FiatData[] = [];
  private fiatConfig: FiatConfig[] = [];
  private lastFetch: Date | null = null;
  private readonly CACHE_DURATION = 60000; // 1 minute

  async initialize(): Promise<void> {
    this.fiatConfig = await FileManager.readJson<FiatConfig[]>('fiats.json') || [];
    console.log(`Loaded ${this.fiatConfig.length} fiat currencies from config`);
  }

  private shouldRefreshCache(): boolean {
    if (!this.lastFetch) return true;
    return Date.now() - this.lastFetch.getTime() > this.CACHE_DURATION;
  }

  async getFiatRatesWithWeights(): Promise<FiatData[]> {
    if (!this.fiatConfig.length) {
      await this.initialize();
    }

    if (!this.shouldRefreshCache() && this.cachedRates.length > 0) {
      return this.cachedRates;
    }

    return this.refreshRates();
  }

  async refreshRates(): Promise<FiatData[]> {
    return withRetry(async () => {
      const baseline = await FileManager.readJson<any>('baseline.json');
      
      try {
        // Get all currencies except USD
        const currencies = this.fiatConfig
          .filter(f => f.code !== 'USD')
          .map(f => f.code)
          .join(',');
        
        const response = await fetch(
          `https://api.exchangerate.host/latest?base=USD&symbols=${currencies}`
        );

        if (!response.ok) {
          throw new Error(`Exchange Rate API error: ${response.status} ${response.statusText}`);
        }

        const data: ExchangeRateResponse = await response.json();
        
        if (!data || !data.rates || typeof data.rates !== 'object') {
          throw new Error('Invalid API response structure');
        }

        // Build rates array starting with USD
        this.cachedRates = [];
        const missingCurrencies: string[] = [];

        for (const config of this.fiatConfig) {
          if (config.code === 'USD') {
            this.cachedRates.push({
              ...config,
              rate: 1.0,
            });
          } else if (data.rates[config.code] && typeof data.rates[config.code] === 'number') {
            this.cachedRates.push({
              ...config,
              rate: data.rates[config.code],
            });
          } else {
            // Use baseline rate if available
            const baselineRate = baseline?.fiat_rates?.[config.code];
            if (baselineRate) {
              console.warn(`Using baseline rate for ${config.code}: ${baselineRate}`);
              this.cachedRates.push({
                ...config,
                rate: baselineRate,
              });
            } else {
              missingCurrencies.push(config.code);
            }
          }
        }

        if (missingCurrencies.length > 0) {
          console.warn(`Missing rates for currencies: ${missingCurrencies.join(', ')}`);
        }

        // Update baseline with current rates
        const fiatRatesForBaseline = this.cachedRates.reduce((acc, rate) => {
          acc[rate.code] = rate.rate;
          return acc;
        }, {} as { [key: string]: number });

        if (baseline) {
          baseline.fiat_rates = { ...baseline.fiat_rates, ...fiatRatesForBaseline };
          baseline.timestamp = new Date().toISOString();
          await FileManager.writeJson('baseline.json', baseline);
        }

        this.lastFetch = new Date();
        console.log(`Fetched rates for ${this.cachedRates.length}/${this.fiatConfig.length} fiat currencies`);
        
        return this.cachedRates;
      } catch (error) {
        // Fallback to baseline data
        if (baseline?.fiat_rates) {
          console.warn('Falling back to baseline fiat rates');
          this.cachedRates = this.fiatConfig.map(config => ({
            ...config,
            rate: baseline.fiat_rates[config.code] || 1.0,
          }));
          return this.cachedRates;
        }
        throw error;
      }
    }, { maxAttempts: 3 });
  }

  getWeightedFiatAverage(): number {
    if (this.cachedRates.length === 0) {
      throw new Error('No fiat rate data available');
    }

    let weightedSum = 0;
    let totalWeight = 0;

    for (const fiat of this.cachedRates) {
      // Use inverse rate to get USD value (since API returns rates FROM USD)
      const usdValue = fiat.code === 'USD' ? 1.0 : 1.0 / fiat.rate;
      weightedSum += usdValue * fiat.weight;
      totalWeight += fiat.weight;
    }

    if (totalWeight === 0) {
      throw new Error('Invalid fiat weights');
    }

    return weightedSum / totalWeight;
  }

  getAllFiatRates(): FiatData[] {
    return this.cachedRates;
  }

  getMissingCurrencies(): string[] {
    const configCodes = this.fiatConfig.map(f => f.code);
    const cachedCodes = this.cachedRates.map(r => r.code);
    return configCodes.filter(code => !cachedCodes.includes(code));
  }
}

export const fiatApiService = new FiatApiService();