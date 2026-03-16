import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

export const CONTRACT_ADDRESS = "0xd77F1Df3103AfB8715b715992b2DBaf8d5529134" as `0x${string}`;
export const SUBMISSION_FEE = BigInt("1000000000000000000"); // 1 GEN in wei
export const EXPLORER_TX = (hash: string) =>
  `https://explorer-bradbury.genlayer.com/tx/${hash}`;

export function getEcosystemRegistry(address?: string | null) {
  const config: Record<string, unknown> = { chain: testnetBradbury };
  if (address) config.account = address as `0x${string}`;
  const client = createClient(config as any);

  return {
    async submitPlayer(url: string): Promise<`0x${string}`> {
      return (await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "submit_player",
        args: [url],
        value: SUBMISSION_FEE,
      })) as `0x${string}`;
    },
  };
}
