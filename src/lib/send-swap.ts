import { Address, beginCell, Cell, toNano, TonClient4 } from '@ton/ton'
import { Asset, Factory, JettonWallet, MAINNET_FACTORY_ADDR, PoolType, SwapParams, VaultJetton, VaultNative } from '@dedust/sdk'
import TonWeb from 'tonweb'
import { TonConnectUI } from '@tonconnect/ui-react';
import { TokenDetail } from '../components/TokenDetail';

const povelDurevTokenAddr = Address.parse("EQB02DJ0cdUD4iQDRbBv4aYG3htePHBRK1tGeRtCnatescK0");
const nativeVaultAddr = Address.parse("EQDa4VOnTYlLvDJ0gZjNYm5PXfSmmtL6Vs6A_CZEtXCNICq_");
const povelDurevVaultAddr = Address.parse("EQB_0ZmfV8bFhm_J_2tcNvdTuOCGT2i_t4FrTArZhXyxizoW");
const tonDurevPoolAddr = Address.parse("EQCCsJOGdUdSGq0ambJFgSptdHfDPkaQlKlLIKTqtazhhcps");

const myAddress = Address.parse('UQBOO2tBR6N8TsU4RBHYaY5Mdss4hx3hJCEMFYYeZsd3xu1Z');
// must be queried onchain for each user/token
// but for a given token, we can calculate wallet address offchain, if we know its wallet code.
const myJettonWalletAddr = Address.parse('EQBC7TfBl0EAuO6k_w0NUCURfItDGzTyfTJ1JlfxShN1HaNd');
const myContractAddress = Address.parse('EQCo_dAv39DAV62oG5HIC_nVeVjIaVZi-Zmlzjbx8AoPqjZb');

const JETTON_SWAP_SELECTOR = 3818968194;
const JETTON_TRANSFER_SELECTOR = 260734629;

function getJettonSwapBody({amount, pool, vault, sender}: {amount: bigint, pool: Address, vault: Address, sender: Address}): Cell {
    const queryId = 0; // can be 0 always, or any value, for tracking
    const limit = 0; // if output of token is less, the tx reverts
    
    const swapParams = beginCell()
        .storeUint(0, 32) // deadline
        .storeAddress(null) // recipientAddress
        .storeAddress(null) // referralAddress
        .storeMaybeRef(null) // fulfillPayload
        .storeMaybeRef(null) // rejectPayload
    .endCell();

    const dedustVaultPayload = beginCell()
        .storeUint(JETTON_SWAP_SELECTOR, 32)
        .storeAddress(pool)
        .storeUint(0, 1) // reserved
        .storeCoins(limit)
        .storeMaybeRef(null)
        .storeRef(swapParams)
    .endCell();

    // first, we transfer the tokens to the vault, then we forward dedustVaultPayload
    const jettonTransferAndSwapPayload = beginCell()
        .storeUint(JETTON_TRANSFER_SELECTOR, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeAddress(vault) // destinationAddress
        .storeAddress(sender) // responseAddress
        .storeMaybeRef(null) 
        .storeCoins(TonWeb.utils.toNano('0.25')) // forwardAmount, used for gas fees
        .storeMaybeRef(dedustVaultPayload) // this is the data/cell we forward to the vault, which gets notified by its jetton wallet
    .endCell();

    // transfer tokens to my contract, then forward jettonTransferAndSwapPayload
    const myContractPayload = beginCell()
        .storeUint(JETTON_TRANSFER_SELECTOR, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeAddress(myContractAddress) // destinationAddress
        .storeAddress(myAddress) // responseAddress
        .storeMaybeRef(null) 
        .storeCoins(TonWeb.utils.toNano('0.55')) // forwardAmount
        .storeMaybeRef(jettonTransferAndSwapPayload) // forwardPayload
    .endCell();

    return myContractPayload
}

export async function sendJettons(tonConnectUi: TonConnectUI, tokenDetail: TokenDetail) {
    const body = getJettonSwapBody({
        amount: TonWeb.utils.toNano('10'),
        pool: tonDurevPoolAddr,
        vault: povelDurevVaultAddr,
        sender: myAddress,
    })

    tonConnectUi.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600, // Valid for 600 seconds
        messages: [
            {
                address: myJettonWalletAddr.toString(),
                amount: toNano('0.75').toString(),
                payload: TonWeb.utils.bytesToBase64(body.toBoc())
            },
        ],
    });
}

/*
===== TON Swap =====
*/

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

async function sendSwap(tonConnectUi: TonConnectUI, tokenDetail: TokenDetail) {
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
    });
}
