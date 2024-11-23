import { Address, beginCell, Cell, toNano, TonClient4 } from '@ton/ton'
import { Asset, Factory, JettonWallet, MAINNET_FACTORY_ADDR, PoolType, SwapParams, VaultJetton, VaultNative } from '@dedust/sdk'
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

function getJettonSwapBody({amount, pool, vault, vaultJettonWallet, sender}: {amount: bigint, pool: Address, vault: Address, vaultJettonWallet: Address, sender: Address}): Cell {
    const queryId = 0;

    const forwardPayload = VaultJetton.createSwapPayload({
        poolAddress: pool,
    });

    const transferBody = beginCell()
        .storeUint(JettonWallet.TRANSFER, 32)
        .storeUint(queryId ?? 0, 64)
        .storeCoins(amount)
        .storeAddress(vault) // destinationAddress
        .storeAddress(sender) // responseAddress
        .storeMaybeRef(null) 
        .storeCoins(TonWeb.utils.toNano('0.25')) // forwardAmount, used for gas fees
        .storeMaybeRef(forwardPayload) // this is the data/cell we forward to the vault, which gets notified by its jetton wallet
    .endCell()

    // needed for my contract. Not needed for dedust
    // const JettonTransfer = beginCell()
    //     .storeAddress(vaultJettonWallet)
    //     .storeCoins(TonWeb.utils.toNano('0.3'))
    //     .storeRef(transferBody)
    // .endCell();

    return transferBody
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

export async function sendJettons(tonConnectUi: TonConnectUI, tokenDetail: TokenDetail) {
    // Initialize the TON client
    const tonClient = new TonClient4({
        endpoint: 'https://mainnet-v4.tonhubapi.com',
    });

    const myAddress = Address.parse('UQBOO2tBR6N8TsU4RBHYaY5Mdss4hx3hJCEMFYYeZsd3xu1Z');
    const myJettonWalletAddr = Address.parse('EQBC7TfBl0EAuO6k_w0NUCURfItDGzTyfTJ1JlfxShN1HaNd');
    const myContractAddress = Address.parse('EQCo_dAv39DAV62oG5HIC_nVeVjIaVZi-Zmlzjbx8AoPqjZb');
    const myContractJettonWallet = Address.parse('EQDpOU5pORTcvTR6kDB5J7CcG7EEzXmaJYd1txw1N1jD0BPD');

    const tokenAddr = Address.parse(tokenDetail.address!);

    // this is a body we can use to send to out jetton wallet, and it will swap money for us.
    const forwardPayload = getJettonSwapBody({
        amount: TonWeb.utils.toNano('0.05'),
        pool: tonDurevPoolAddr,
        vault: povelDurevVaultAddr,
        vaultJettonWallet: myContractJettonWallet,
        sender: myAddress,
    })

    const dataForMyContract = beginCell()
        .storeAddress(myContractJettonWallet)
        .storeCoins(TonWeb.utils.toNano('0.25'))
        .storeRef(forwardPayload)
    .endCell();

    const body = beginCell()
        .storeUint(JettonWallet.TRANSFER, 32)
        .storeUint(0 ?? 0, 64)
        .storeCoins(TonWeb.utils.toNano('1'))
        .storeAddress(myContractAddress) // destinationAddress
        .storeAddress(myAddress) // responseAddress
        .storeMaybeRef(null) 
        // .storeCoins(TonWeb.utils.toNano('1.35')) // forwardAmount
        .storeCoins(TonWeb.utils.toNano('1.15')) // forwardAmount
        .storeMaybeRef(forwardPayload) // forwardPayload
    .endCell()

    // const transferBody = beginCell()
    //     .storeUint(JettonWallet.TRANSFER, 32)
    //     .storeUint(queryId ?? 0, 64)
    //     .storeCoins(amount)
    //     .storeAddress(vault) // destinationAddress
    //     .storeAddress(sender) // responseAddress
    //     .storeMaybeRef(null) 
    //     .storeCoins(TonWeb.utils.toNano('0.25')) // forwardAmount, used for gas fees
    //     .storeMaybeRef(forwardPayload) // this is the data/cell we forward to the vault, which gets notified by its jetton wallet
    // .endCell()

    tonConnectUi.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600, // Valid for 600 seconds
        messages: [
            {
                address: myJettonWalletAddr.toString(),
                amount: toNano('1.37').toString(),
                payload: TonWeb.utils.bytesToBase64(body.toBoc())
            },
        ],
    });
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
    });
}
