import type { Account, Chain, Client, Hex, Transport } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import type { ENTRYPOINT_ADDRESS_V06_TYPE, Prettify } from "../../types"
import {
    type BiconomySmartAccount,
    type SignerToBiconomySmartAccountParameters,
    signerToBiconomySmartAccount
} from "./signerToBiconomySmartAccount"

export type PrivateKeyToBiconomySmartAccountParameters<
    entryPoint extends ENTRYPOINT_ADDRESS_V06_TYPE
> = Prettify<
    {
        privateKey: Hex
    } & Omit<SignerToBiconomySmartAccountParameters<entryPoint>, "signer">
>

/**
 * @description Creates a Biconomy Smart Account from a private key.
 *
 * @returns A Private Key Biconomy Smart Account using ECDSA as default validation module.
 */
export async function privateKeyToBiconomySmartAccount<
    entryPoint extends ENTRYPOINT_ADDRESS_V06_TYPE,
    TTransport extends Transport = Transport,
    TChain extends Chain | undefined = Chain | undefined,
    TClientAccount extends Account | undefined = Account | undefined
>(
    client: Client<TTransport, TChain, TClientAccount>,
    {
        privateKey,
        ...rest
    }: PrivateKeyToBiconomySmartAccountParameters<entryPoint>
): Promise<BiconomySmartAccount<entryPoint, TTransport, TChain>> {
    const privateKeyAccount = privateKeyToAccount(privateKey)
    return signerToBiconomySmartAccount<
        entryPoint,
        TTransport,
        TChain,
        TClientAccount,
        "privateKey"
    >(client, {
        signer: privateKeyAccount,
        ...rest
    })
}
