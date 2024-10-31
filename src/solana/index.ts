import { Commitment, Connection, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

// Create a connection to the Solana network
export const solanaConnection = new Connection(process.env.RPC_ENDPOINT as string, {
  commitment: process.env.COMMITMENT as Commitment,
});

// Read private keys from the privates.txt file
const privateKeyPath = 'privates.txt';
const privateKeys = fs.readFileSync(privateKeyPath, 'utf-8').trim().split('\n');

// Create an array to hold the Keypair objects
export const wallets = privateKeys.map(key => {
  // Decode the private key and create a Keypair
  return Keypair.fromSecretKey(bs58.decode(key.trim()));
});

// Now you can use the `wallets` array to access each Keypair
