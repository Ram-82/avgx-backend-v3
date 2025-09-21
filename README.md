# AVGX Backend

The backend services and smart contracts for the AVGX Protocol.

## Components

### Smart Contracts
- **AVGXToken**: ERC20 token with governance and access control
- **AVGXCalculator**: Calculates the AVGX index using sqrt(WF * WC) formula
- **AVGXAMM**: Automated market maker for minting/redeeming AVGX
- **AVGXOracleRouter**: Routes price feed requests to Chainlink oracles
- **AVGXVault**: Holds base asset reserves and manages liquidity
- **AVGXAccessController**: Role-based access control system
- **AVGXTimelock**: Governance timelock for critical operations

### Backend Services
- **API Server**: Express.js server with real-time price data
- **Database**: PostgreSQL with Drizzle ORM
- **External APIs**: Integration with crypto and fiat price feeds

## Tech Stack

- **Smart Contracts**: Solidity with OpenZeppelin
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Blockchain**: Hardhat for development and testing
- **Testing**: Mocha, Chai for smart contract testing

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Configure your RPC URLs and private keys
```

3. Compile smart contracts:
```bash
npm run compile
```

4. Run tests:
```bash
npm run test
```

5. Start development server:
```bash
npm run dev
```

## Deployment

### Local Development
```bash
npm run node          # Start local Hardhat node
npm run deploy:local  # Deploy contracts locally
```

### Testnet Deployment
```bash
npm run deploy:sepolia  # Deploy to Ethereum Sepolia
npm run deploy:amoy     # Deploy to Polygon Amoy
```

## Project Structure

```
backend/
├── contracts/           # Solidity smart contracts
│   ├── interfaces/     # Contract interfaces
│   ├── libraries/      # Solidity libraries
│   └── mocks/         # Mock contracts for testing
├── scripts/           # Deployment and utility scripts
├── test/              # Smart contract tests
├── server/            # Backend API server
│   ├── services/      # Business logic services
│   └── utils/         # Utility functions
├── data/              # Static data files
├── shared/            # Shared schemas and types
├── hardhat.config.ts  # Hardhat configuration
└── drizzle.config.ts  # Database configuration
```
