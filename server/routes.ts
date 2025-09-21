import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertContactSchema } from "@shared/schema";
import { cryptoApiService } from "./services/crypto-api";
import { fiatApiService } from "./services/fiat-api";
import { avgxCalculatorService } from "./services/avgx-calculator";
import { avgxCoinService } from "./services/avgx-coin";
import { FileManager } from "./utils/file-manager";
import { insertTransactionSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
   // API to keep the DB active
  app.get('/', async (req, res) => {
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT NOW()'); // Simple query to check connection
      client.release(); // Release the client back to the pool
  
      res.status(200).json({
        message: 'Successfully connected to the database and fetched data!',
        databaseTime: result.rows[0].now,
      });
    } catch (err: any) {
      console.error('Database connection or query error:', err);
      res.status(500).json({
        success: false,
        message: 'Failed to connect to the database.',
        error: err.message,
      });
    }
  });
  
  // Core AVGX endpoint - returns current WF, WC, avgx_usd, breakdown
  app.get("/api/avgx", async (req, res) => {
    try {
      const breakdown = await avgxCalculatorService.getDetailedBreakdown();
      res.json({
        avgx_usd: breakdown.avgx.avgx_usd,
        wf_value: breakdown.avgx.wf_value,
        wc_value: breakdown.avgx.wc_value,
        change24h: breakdown.avgx.change24h,
        timestamp: breakdown.avgx.timestamp,
        breakdown: {
          fiat_basket: breakdown.fiatBasket,
          crypto_basket: breakdown.cryptoBasket
        }
      });
    } catch (error: any) {
      console.error("AVGX API error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to calculate AVGX"
      });
    }
  });

  // Prices endpoint - AVGX converted to all fiats & crypto units
  app.get("/api/prices", async (req, res) => {
    try {
      const [fiatPrices, avgxData, cryptoData] = await Promise.all([
        avgxCalculatorService.convertToAllCurrencies(),
        avgxCalculatorService.getCurrentAvgx(),
        cryptoApiService.getCryptoPricesWithWeights()
      ]);

      const cryptoPrices = cryptoData.map(crypto => ({
        symbol: crypto.symbol,
        name: crypto.name,
        price_usd: crypto.price,
        avgx_rate: avgxData.avgx_usd / crypto.price // 1 AVGX = X crypto units
      }));

      res.json({
        avgx_usd: avgxData.avgx_usd,
        fiat_conversions: fiatPrices,
        crypto_conversions: cryptoPrices,
        timestamp: avgxData.timestamp
      });
    } catch (error: any) {
      console.error("Prices API error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch price conversions"
      });
    }
  });

  // Historical data endpoint
  app.get("/api/history", async (req, res) => {
    try {
      const timeframe = (req.query.timeframe as string) || '24h';
      const validTimeframes = ['24h', '7d', '30d'];

      if (!validTimeframes.includes(timeframe)) {
        return res.status(400).json({
          success: false,
          message: "Invalid timeframe. Use: 24h, 7d, 30d"
        });
      }

      const history = await avgxCalculatorService.getHistoricalData(timeframe as any);
      res.json({
        timeframe,
        data: history,
        count: history.length
      });
    } catch (error: any) {
      console.error("History API error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch historical data"
      });
    }
  });

  // Simulate swap endpoint
  app.post("/api/simulate-swap", async (req, res) => {
    try {
      const { fromToken, toToken, amount, userAddress } = req.body;

      if (!fromToken || !toToken || !amount || !userAddress) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: fromToken, toToken, amount, userAddress"
        });
      }

      const avgxData = await avgxCalculatorService.getCurrentAvgx();

      // Simulate conversion rates
      let exchangeRate = 1;
      if (fromToken === 'ETH' && toToken === 'AVGX') {
        exchangeRate = 2800 / avgxData.avgx_usd; // Approximate ETH price
      } else if (fromToken === 'MATIC' && toToken === 'AVGX') {
        exchangeRate = 0.85 / avgxData.avgx_usd; // Approximate MATIC price
      } else if (fromToken === 'AVGX' && toToken === 'ETH') {
        exchangeRate = avgxData.avgx_usd / 2800;
      } else if (fromToken === 'AVGX' && toToken === 'MATIC') {
        exchangeRate = avgxData.avgx_usd / 0.85;
      }

      const outputAmount = parseFloat(amount) * exchangeRate;

      // Generate mock transaction hash
      const txHash = `0x${Math.random().toString(16).substring(2).padStart(64, '0')}`;

      // Log the simulated swap
      console.log(`Simulated swap: ${amount} ${fromToken} -> ${outputAmount.toFixed(6)} ${toToken} for ${userAddress}`);

      res.json({
        success: true,
        transaction: {
          hash: txHash,
          from: userAddress,
          fromToken,
          toToken,
          inputAmount: amount,
          outputAmount: outputAmount.toFixed(6),
          exchangeRate: exchangeRate.toFixed(6),
          gasEstimate: "0.001",
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error("Simulate swap error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to simulate swap"
      });
    }
  });

  // Admin endpoint for baseline status
  app.get("/api/admin/baseline_status", async (req, res) => {
    try {
      const [baseline, fiatConfig, cryptoConfig] = await Promise.all([
        FileManager.readJson<any>('baseline.json'),
        FileManager.readJson<any[]>('fiats.json'),
        FileManager.readJson<any[]>('cryptos.json')
      ]);

      const missingFiats = fiatApiService.getMissingCurrencies();
      const missingCryptos = cryptoApiService.getMissingCryptos();

      res.json({
        baseline_timestamp: baseline?.timestamp,
        config: {
          total_fiats: fiatConfig?.length || 0,
          total_cryptos: cryptoConfig?.length || 0
        },
        missing_data: {
          fiat_currencies: missingFiats,
          cryptocurrencies: missingCryptos
        },
        baseline_values: {
          avgx_value: baseline?.avgx_value,
          wf_value: baseline?.wf_value,
          wc_value: baseline?.wc_value
        }
      });
    } catch (error: any) {
      console.error("Baseline status error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get baseline status"
      });
    }
  });

  // Contact form submission
  app.post("/api/contact", async (req, res) => {
    try {
      const validatedData = insertContactSchema.parse(req.body);
      const contact = await storage.createContact(validatedData);
      res.json({ success: true, contact });
    } catch (error: any) {
      console.error("Contact form error:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to submit contact form"
      });
    }
  });

  // Debug endpoint for stability formula transparency
  app.get("/api/v2/avgx/debug", async (req, res) => {
    try {
      const debugInfo = await avgxCalculatorService.getDebugInfo();
      res.json({
        success: true,
        data: debugInfo
      });
    } catch (error: any) {
      console.error("Debug API error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get debug information"
      });
    }
  });

  // Legacy endpoints for backward compatibility
  app.get("/api/avgx/index", async (req, res) => {
    try {
      const avgxData = await avgxCalculatorService.getCurrentAvgx();
      res.json({
        value: avgxData.avgx_usd,
        wfValue: avgxData.wf_value,
        wcValue: avgxData.wc_value,
        change24h: avgxData.change24h,
        timestamp: avgxData.timestamp
      });
    } catch (error: any) {
      console.error("Legacy index error:", error);
      res.status(500).json({ success: false, message: "Failed to get index" });
    }
  });

  app.get("/api/avgx/fiat-rates", async (req, res) => {
    try {
      const fiatRates = await fiatApiService.getFiatRatesWithWeights();
      res.json(fiatRates);
    } catch (error: any) {
      console.error("Legacy fiat rates error:", error);
      res.status(500).json({ success: false, message: "Failed to get fiat rates" });
    }
  });

  app.get("/api/avgx/crypto-prices", async (req, res) => {
    try {
      const cryptoPrices = await cryptoApiService.getCryptoPricesWithWeights();
      res.json(cryptoPrices);
    } catch (error: any) {
      console.error("Legacy crypto prices error:", error);
      res.status(500).json({ success: false, message: "Failed to get crypto prices" });
    }
  });

  app.get("/api/avgx/chart/:timeframe", async (req, res) => {
    try {
      const timeframe = req.params.timeframe;
      const mappedTimeframe = timeframe === '1m' ? '30d' : timeframe === '1y' ? '30d' : timeframe;
      const history = await avgxCalculatorService.getHistoricalData(mappedTimeframe as any);
      res.json(history.map(h => ({ timestamp: new Date(h.timestamp), value: h.avgx_usd })));
    } catch (error: any) {
      console.error("Legacy chart error:", error);
      res.json([]);
    }
  });

  // Serve whitepaper PDF
  app.get('/api/whitepaper', (req, res) => {
    try {
      const path = require('path');
      const fs = require('fs');
      const pdfPath = path.join(__dirname, '..', 'attached_assets', 'avgx_whitepaper_updated_1756141073689.pdf');
      
      if (!fs.existsSync(pdfPath)) {
        return res.status(404).json({ error: 'Whitepaper not found' });
      }
      
      res.setHeader('Content-Type', 'application/pdf');
      // Check if inline viewing is requested
      const isInline = req.query.inline === 'true';
      if (isInline) {
        res.setHeader('Content-Disposition', 'inline; filename="AVGX_Whitepaper.pdf"');
      } else {
        res.setHeader('Content-Disposition', 'attachment; filename="AVGX_Whitepaper.pdf"');
      }
      
      const fileStream = fs.createReadStream(pdfPath);
      fileStream.pipe(res);
    } catch (error) {
      console.error('Error serving whitepaper:', error);
      res.status(500).json({ error: 'Failed to serve whitepaper' });
    }
  });

  // AVGX Coin endpoints
  app.get('/api/coin/status', async (req, res) => {
    try {
      const coinData = await avgxCoinService.getCoinStatus();
      res.json(coinData);
    } catch (error) {
      console.error('Error fetching coin status:', error);
      res.status(500).json({ error: 'Failed to fetch coin status' });
    }
  });

  app.get('/api/coin/reserves', async (req, res) => {
    try {
      const reserves = await avgxCoinService.getReserveBreakdown();
      res.json(reserves);
    } catch (error: any) {
      console.error("Reserves API error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch reserves"
      });
    }
  });

  app.get('/api/coin/stats', async (req, res) => {
    try {
      const stats = await avgxCoinService.getCoinStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching coin stats:', error);
      res.status(500).json({ error: 'Failed to fetch coin stats' });
    }
  });

  app.post("/api/coin/calculate-mint", async (req, res) => {
    try {
      const { usdValue } = req.body;
      if (!usdValue || usdValue <= 0) {
        return res.status(400).json({
          success: false,
          message: "Valid USD value required"
        });
      }

      const calculation = await avgxCoinService.calculateMintAmount(usdValue);
      res.json(calculation);
    } catch (error: any) {
      console.error("Calculate mint API error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to calculate mint amount"
      });
    }
  });

  app.post('/api/coin/simulate-trade', async (req, res) => {
    try {
      const { action, amount, chain } = req.body;

      if (!action || !amount) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }

      const amountNum = parseFloat(amount);
      
      if (isNaN(amountNum) || amountNum <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
      }

      const result = await avgxCoinService.simulateTrade(action, amountNum, chain || 'sepolia');
      res.json(result);
    } catch (error) {
      console.error('Error simulating trade:', error);
      res.status(500).json({ error: 'Failed to simulate trade' });
    }
  });


  const httpServer = createServer(app);
  return httpServer;
}
