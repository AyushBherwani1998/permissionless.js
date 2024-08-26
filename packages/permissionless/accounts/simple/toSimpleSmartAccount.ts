import {
    type Address,
    type Assign,
    type Client,
    type Hex,
    type LocalAccount,
    encodeFunctionData
} from "viem"
import {
    type SmartAccount,
    type SmartAccountImplementation,
    type UserOperation,
    entryPoint06Abi,
    type entryPoint06Address,
    entryPoint07Abi,
    entryPoint07Address,
    getUserOperationHash,
    toSmartAccount
} from "viem/account-abstraction"
import { getChainId, signMessage } from "viem/actions"
import { getAction } from "viem/utils"
import { getAccountNonce } from "../../actions/public/getAccountNonce"
import { getSenderAddress } from "../../actions/public/getSenderAddress"

const getAccountInitCode = async (
    owner: Address,
    index = BigInt(0)
): Promise<Hex> => {
    if (!owner) throw new Error("Owner account not found")

    return encodeFunctionData({
        abi: [
            {
                inputs: [
                    {
                        internalType: "address",
                        name: "owner",
                        type: "address"
                    },
                    {
                        internalType: "uint256",
                        name: "salt",
                        type: "uint256"
                    }
                ],
                name: "createAccount",
                outputs: [
                    {
                        internalType: "contract SimpleAccount",
                        name: "ret",
                        type: "address"
                    }
                ],
                stateMutability: "nonpayable",
                type: "function"
            }
        ],
        functionName: "createAccount",
        args: [owner, index]
    })
}

export type ToSimpleSmartAccountParameters<
    entryPointVersion extends "0.6" | "0.7"
> = {
    client: Client
    owner: LocalAccount
    factoryAddress?: Address
    entryPoint?: {
        address: typeof entryPoint06Address | typeof entryPoint07Address
        version: entryPointVersion
    }
    index?: bigint
    address?: Address
    nonceKey?: bigint
}

const getFactoryAddress = (
    entryPointVersion: "0.6" | "0.7",
    factoryAddress?: Address
): Address => {
    if (factoryAddress) return factoryAddress

    if (entryPointVersion === "0.6") {
        return "0x9406Cc6185a346906296840746125a0E44976454"
    }
    return "0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985"
}

export type SimpleSmartAccountImplementation<
    entryPointVersion extends "0.6" | "0.7" = "0.7"
> = Assign<
    SmartAccountImplementation<
        entryPointVersion extends "0.6"
            ? typeof entryPoint06Abi
            : typeof entryPoint07Abi,
        entryPointVersion
        // {
        //     // entryPoint === ENTRYPOINT_ADDRESS_V06 ? "0.2.2" : "0.3.0-beta"
        //     abi: entryPointVersion extends "0.6" ? typeof BiconomyAbi
        //     factory: { abi: typeof FactoryAbi; address: Address }
        // }
    >,
    { sign: NonNullable<SmartAccountImplementation["sign"]> }
>

export type ToSimpleSmartAccountReturnType<
    entryPointVersion extends "0.6" | "0.7" = "0.7"
> = SmartAccount<SimpleSmartAccountImplementation<entryPointVersion>>

/**
 * @description Creates an Simple Account from a private key.
 *
 * @returns A Private Key Simple Account.
 */
export async function toSimpleSmartAccount<
    entryPointVersion extends "0.6" | "0.7"
>(
    parameters: ToSimpleSmartAccountParameters<entryPointVersion>
): Promise<ToSimpleSmartAccountReturnType<entryPointVersion>> {
    const {
        client,
        owner,
        factoryAddress: _factoryAddress,
        index = BigInt(0),
        address,
        nonceKey
    } = parameters

    const entryPoint = {
        address: parameters.entryPoint?.address ?? entryPoint07Address,
        abi:
            (parameters.entryPoint?.version ?? "0.7") === "0.6"
                ? entryPoint06Abi
                : entryPoint07Abi,
        version: parameters.entryPoint?.version ?? "0.7"
    } as const

    const factoryAddress = getFactoryAddress(
        entryPoint.version,
        _factoryAddress
    )

    let accountAddress: Address | undefined = address

    let chainId: number

    const getMemoizedChainId = async () => {
        if (chainId) return chainId
        chainId = client.chain
            ? client.chain.id
            : await getAction(client, getChainId, "getChainId")({})
        return chainId
    }

    const getFactoryArgs = async () => {
        return {
            factory: factoryAddress,
            factoryData: await getAccountInitCode(owner.address, index)
        }
    }

    return toSmartAccount({
        client,
        entryPoint,
        getFactoryArgs,
        async getAddress() {
            if (accountAddress) return accountAddress

            const { factory, factoryData } = await getFactoryArgs()

            // Get the sender address based on the init code
            accountAddress = await getSenderAddress(client, {
                factory,
                factoryData,
                entryPointAddress: entryPoint.address
            })

            return accountAddress
        },
        async encodeCalls(calls) {
            if (calls.length > 1) {
                if (entryPoint.version === "0.6") {
                    return encodeFunctionData({
                        abi: [
                            {
                                inputs: [
                                    {
                                        internalType: "address[]",
                                        name: "dest",
                                        type: "address[]"
                                    },
                                    {
                                        internalType: "bytes[]",
                                        name: "func",
                                        type: "bytes[]"
                                    }
                                ],
                                name: "executeBatch",
                                outputs: [],
                                stateMutability: "nonpayable",
                                type: "function"
                            }
                        ],
                        functionName: "executeBatch",
                        args: [
                            calls.map((a) => a.to),
                            calls.map((a) => a.data ?? "0x")
                        ]
                    })
                }
                return encodeFunctionData({
                    abi: [
                        {
                            inputs: [
                                {
                                    internalType: "address[]",
                                    name: "dest",
                                    type: "address[]"
                                },
                                {
                                    internalType: "uint256[]",
                                    name: "value",
                                    type: "uint256[]"
                                },
                                {
                                    internalType: "bytes[]",
                                    name: "func",
                                    type: "bytes[]"
                                }
                            ],
                            name: "executeBatch",
                            outputs: [],
                            stateMutability: "nonpayable",
                            type: "function"
                        }
                    ],
                    functionName: "executeBatch",
                    args: [
                        calls.map((a) => a.to),
                        calls.map((a) => a.value ?? 0n),
                        calls.map((a) => a.data ?? "0x")
                    ]
                })
            }

            return encodeFunctionData({
                abi: [
                    {
                        inputs: [
                            {
                                internalType: "address",
                                name: "dest",
                                type: "address"
                            },
                            {
                                internalType: "uint256",
                                name: "value",
                                type: "uint256"
                            },
                            {
                                internalType: "bytes",
                                name: "func",
                                type: "bytes"
                            }
                        ],
                        name: "execute",
                        outputs: [],
                        stateMutability: "nonpayable",
                        type: "function"
                    }
                ],
                functionName: "execute",
                args: [calls[0].to, calls[0].value ?? 0n, calls[0].data ?? "0x"]
            })
        },
        async getNonce(args) {
            return getAccountNonce(client, {
                address: await this.getAddress(),
                entryPointAddress: entryPoint.address,
                key: args?.key ?? nonceKey
            })
        },
        async getStubSignature() {
            return "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c"
        },
        async sign({ hash }) {
            return this.signMessage({ message: hash })
        },
        signMessage: async (_) => {
            throw new Error("Simple account isn't 1271 compliant")
        },
        signTypedData: async (_) => {
            throw new Error("Simple account isn't 1271 compliant")
        },
        async signUserOperation(parameters) {
            const { chainId = await getMemoizedChainId(), ...userOperation } =
                parameters
            return signMessage(client, {
                account: owner,
                message: {
                    raw: getUserOperationHash({
                        userOperation: {
                            ...userOperation,
                            sender:
                                userOperation.sender ??
                                (await this.getAddress()),
                            signature: "0x"
                        } as UserOperation<entryPointVersion>,
                        entryPointAddress: entryPoint.address,
                        entryPointVersion: entryPoint.version,
                        chainId: chainId
                    })
                }
            })
        }
    }) as Promise<ToSimpleSmartAccountReturnType<entryPointVersion>>
}
