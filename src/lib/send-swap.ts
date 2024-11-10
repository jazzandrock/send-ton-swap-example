import { Address, beginCell, Cell, toNano, TonClient4 } from '@ton/ton'
import { Asset, Factory, MAINNET_FACTORY_ADDR, PoolType, SwapParams, VaultNative } from '@dedust/sdk'
import TonWeb from 'tonweb'
import { TonConnectUI } from '@tonconnect/ui-react';
import { TokenDetail } from '../components/TokenDetail';

const povelDurevTokenAddr = Address.parse("EQB02DJ0cdUD4iQDRbBv4aYG3htePHBRK1tGeRtCnatescK0");
const nativeVaultAddr = Address.parse("EQDa4VOnTYlLvDJ0gZjNYm5PXfSmmtL6Vs6A_CZEtXCNICq_");
const povelDurevVaultAddr = Address.parse("EQB_0ZmfV8bFhm_J_2tcNvdTuOCGT2i_t4FrTArZhXyxizoW");
const tonDurevPoolAddr = Address.parse("EQCCsJOGdUdSGq0ambJFgSptdHfDPkaQlKlLIKTqtazhhcps");

function prepareSwapPayload() {

    // return TonWeb.utils.bytesToBase64(cell.toBoc())
}

function getTonSwapBody(amount: bigint, pool: Address): string {
    const swapParams = {};

    function packSwapParams({
        deadline,
        recipientAddress,
        referralAddress,
        fulfillPayload,
        rejectPayload,
      }: SwapParams) {
        return beginCell()
          .storeUint(deadline ?? 0, 32)
          .storeAddress(recipientAddress ?? null)
          .storeAddress(referralAddress ?? null)
          .storeMaybeRef(fulfillPayload)
          .storeMaybeRef(rejectPayload)
          .endCell();
      }

    const body = beginCell()
        .storeUint(VaultNative.SWAP, 32)
        .storeUint(0, 64)
        .storeCoins(amount)
        .storeAddress(pool)
        .storeUint(0, 1)
        .storeCoins(0)
        .storeMaybeRef(null)
        .storeRef(packSwapParams(swapParams))
    .endCell()

    return TonWeb.utils.bytesToBase64(body.toBoc())
}

async function getNativeVaultAddress() {
    // Initialize the TON client
    const tonClient = new TonClient4({
        endpoint: 'https://mainnet-v4.tonhubapi.com',
    });

    // Create a factory instance
    const factory = tonClient.open(Factory.createFromAddress(MAINNET_FACTORY_ADDR));

    // Retrieve the native vault address
    const nativeVault = await factory.getNativeVault();
    const nativeVaultAddress = nativeVault.address.toString();

    const POVEL_DUREV_ADDRESS = Address.parse('EQB02DJ0cdUD4iQDRbBv4aYG3htePHBRK1tGeRtCnatescK0');
    const POVEL_DUREV_VAULT = await factory.getJettonVault(POVEL_DUREV_ADDRESS);

    const TON = Asset.native();
    const POVEL_DUREV = Asset.jetton(POVEL_DUREV_ADDRESS);

    const pool = await factory.getPool(PoolType.VOLATILE, [TON, POVEL_DUREV]);
    console.log('Pool Address:', pool.address.toString());
    console.log('Povel Durev Vault Address:', POVEL_DUREV_VAULT.address.toString());

    console.log('Native Token Vault Address:', nativeVaultAddress);
}

export async function sendSwap(tonConnectUi: TonConnectUI, tokenDetail: TokenDetail) {
    // Initialize the TON client
    const tonClient = new TonClient4({
        endpoint: 'https://mainnet-v4.tonhubapi.com',
    });

    // Create a factory instance
    const factory = tonClient.open(Factory.createFromAddress(MAINNET_FACTORY_ADDR));

    console.log(`Token address: ${tokenDetail.address}`)
    const tokenAddr = Address.parse(tokenDetail.address!);
    // const vaultAddr = await factory.getJettonVault(tokenAddr);

    const TON = Asset.native();
    const JETTON = Asset.jetton(tokenAddr);

    const pool = await factory.getPool(PoolType.VOLATILE, [TON, JETTON]);

    const amount = toNano('0.2');
    const payload = getTonSwapBody(amount, pool.address);
    await tonConnectUi.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600, // Valid for 600 seconds
        messages: [
            {
                address: nativeVaultAddr.toString(),
                amount: (amount + toNano('0.2')).toString(),
                payload,
            },
        ],
    })
}
