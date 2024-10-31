import { Commitment, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { solanaConnection, wallets } from './solana'; // Assuming you updated wallets to handle multiple keys
import { getTokenAccounts } from './cryptoQueries';
import logger from './utils/logger';
import { getMint, createBurnCheckedInstruction, createCloseAccountInstruction } from '@solana/spl-token';

export default async function clean(forceBurn: boolean): Promise<void> {
  logger.info(`Running ${forceBurn ? 'full ' : ''}clean`);

  // Iterate over all wallets
  for (const wallet of wallets) {
    logger.info(`Cleaning token accounts for wallet: ${wallet.publicKey.toString()}`);
    const existingTokenAccounts = await getTokenAccounts(
      solanaConnection,
      wallet.publicKey,
      process.env.COMMITMENT as Commitment,
    );

    logger.info(`Got ${existingTokenAccounts.length} accounts for wallet: ${wallet.publicKey.toString()}`);
    
    for (const tokenAccount of existingTokenAccounts) {
      try {
        const mintAccount = await getMint(
          solanaConnection,
          tokenAccount.accountInfo.mint,
          process.env.COMMITMENT as Commitment,
        );

        if (mintAccount.freezeAuthority) {
          logger.warn(`${tokenAccount.accountInfo.mint.toString()} is frozen, skipping`);
          continue;
        }

        if (!forceBurn && tokenAccount.accountInfo.amount > 0) {
          logger.warn(`${tokenAccount.accountInfo.mint.toString()} still has tokens, skipping`);
          continue;
        }

        const burnIx = createBurnCheckedInstruction(
          tokenAccount.pubkey,
          tokenAccount.accountInfo.mint,
          wallet.publicKey,
          tokenAccount.accountInfo.amount,
          mintAccount.decimals,
        );

        const recentBlockhash = await solanaConnection.getLatestBlockhash('finalized');
        const closeAccount = createCloseAccountInstruction(tokenAccount.pubkey, wallet.publicKey, wallet.publicKey);

        const messageV0 = new TransactionMessage({
          payerKey: wallet.publicKey,
          recentBlockhash: recentBlockhash.blockhash,
          instructions: forceBurn ? [burnIx, closeAccount] : [closeAccount],
        }).compileToV0Message();

        const transaction = new VersionedTransaction(messageV0);
        transaction.sign([wallet]);

        const signature = await solanaConnection.sendRawTransaction(transaction.serialize(), {
          skipPreflight: false,
        });

        logger.info(`Sent transaction ${signature} for account ${tokenAccount.pubkey.toString()}`);
        await new Promise((resolve) => setTimeout(resolve, 100)); // Rate limiting
      } catch (error) {
        logger.error(`Error processing account ${tokenAccount.pubkey.toString()}: ${error}`);
      }
    }
  }

  logger.info(`Clean completed`);
}
