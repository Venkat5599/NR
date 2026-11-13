package app.lunar.keyboard.near

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigInteger

/** The receive address flow, against data recorded from the 20 USDC recovery on Base Sepolia. */
class ReceiveTest {
    private fun res(name: String) = javaClass.classLoader!!.getResource(name)!!.readText()

    private val address = "0xa8871e9879d17e229d73c5faeff677d5a8cd2bd2"
    private val inTx = "0xc09d77529ca463882bdaf3e6a07c29c18ddbb9c75eb6242bc19e8c5d5f29543c"

    @Test
    fun `only transfers that arrived at the address are listed, not the forward that left it`() {
        val list = Evm.parseIncoming(res("blockscout_transfers.json"), Evm.USDC, address)
        assertEquals(1, list.size)
        val t = list[0]
        assertEquals(inTx, t.txHash)
        assertEquals(0L, t.logIndex)
        assertEquals(57802750L, t.block)
        assertEquals("0xfaec9cdc3ef75713b48f46057b98ba04885e3391", t.from)
        assertEquals(BigInteger("20000000"), t.amount)
        assertEquals("20", Evm.usdc(t.amount))
    }

    @Test
    fun `transfers of another token are not listed`() {
        assertTrue(Evm.parseIncoming(res("blockscout_transfers.json"), "0x0000000000000000000000000000000000000001", address).isEmpty())
    }

    @Test
    fun `the log handed to the contract has exactly the fields it reads`() {
        val log = Evm.pickLog(JSONObject(res("evm_receipt_in.json")).getJSONObject("result"), 0)
        assertEquals(setOf("removed", "logIndex", "transactionIndex", "transactionHash", "blockHash", "blockNumber", "address", "data", "topics"), log.keys().asSequence().toSet())
        assertEquals(inTx, log.getString("transactionHash"))
        assertEquals("0x" + Evm.addressWord(address), log.getJSONArray("topics").getString(2))
    }

    @Test(expected = NearClient.RpcException::class)
    fun `asking for a log the transaction doesn't have fails`() {
        Evm.pickLog(JSONObject(res("evm_receipt_in.json")).getJSONObject("result"), 7)
    }

    @Test
    fun `the receiver view reads the receive address and where it forwards`() {
        val r = ReceiveContract.parseReceiver(res("receive_receiver.json"))!!
        assertEquals(address, r.address)
        assertEquals("0xd74d0a875c8b3c9d5ad723b76a0ac40d8dca3345", r.forwardTo)
        assertNull(ReceiveContract.parseReceiver("null"))
    }

    @Test
    fun `a signed transfer record carries the transaction to broadcast`() {
        val rec = ReceiveContract.parseRecord(res("receive_transfer_signed.json"))!!
        assertEquals("Signed", rec.status)
        assertEquals("0xd74d0a875c8b3c9d5ad723b76a0ac40d8dca3345", rec.destination)
        assertFalse(rec.refund)
        assertEquals("0x07fd29e44559aa6d0c869a6bec510a88320abf5991873db59493881855d2d720", rec.evmTxHash)
        assertTrue(rec.signedTx!!.startsWith("0x02"))
    }

    @Test
    fun `stages follow the record and Base's finality`() {
        val signed = ReceiveContract.parseRecord(res("receive_transfer_signed.json"))!!
        assertEquals(Stage.Finalizing(5890 * 2), Stage.of(58277471, 58271581, null, null))
        assertEquals(Stage.Ready, Stage.of(100, 100, null, null))
        assertEquals(Stage.Verifying, Stage.of(100, 200, signed.copy(status = "Verifying"), null))
        assertEquals(Stage.Signing, Stage.of(100, 200, signed.copy(status = "Verified"), null))
        assertEquals(Stage.Signed(signed.signedTx!!, signed.evmTxHash!!), Stage.of(100, 200, signed, "missing"))
        assertEquals(Stage.Done(signed.evmTxHash!!, true, signed.destination, false), Stage.of(57802750, 58271581, signed, "success"))
        assertEquals(Stage.Done(signed.evmTxHash!!, false, signed.destination, false), Stage.of(100, 200, signed, "reverted"))
    }

    @Test
    fun `forward fees follow the watcher's rule and the contract's cap`() {
        assertEquals(BigInteger.valueOf(2_100_000) to BigInteger.valueOf(100_000), Evm.fees(BigInteger.valueOf(1_000_000), BigInteger.valueOf(100_000), ReceiveContract.MAX_FEE_CAP))
        assertEquals(ReceiveContract.MAX_FEE_CAP to ReceiveContract.MAX_FEE_CAP,
            Evm.fees(BigInteger("200000000000"), BigInteger("300000000000"), ReceiveContract.MAX_FEE_CAP))
        assertEquals(BigInteger.valueOf(210_000_000_000), Stage.gasNeeded(BigInteger.valueOf(2_100_000)))
    }

    @Test
    fun `waits read in hours and minutes`() {
        assertEquals("about 3 h 16 min", Stage.wait(11780))
        assertEquals("about 4 min", Stage.wait(250))
        assertEquals("under a minute", Stage.wait(30))
    }

    @Test
    fun `only 0x plus 40 hex is a Base address`() {
        assertTrue(Evm.isAddress("0xd74d0a875c8b3c9d5ad723b76a0ac40d8dca3345"))
        assertFalse(Evm.isAddress("d74d0a875c8b3c9d5ad723b76a0ac40d8dca3345"))
        assertFalse(Evm.isAddress("0xd74d0a875c8b3c9d5ad723b76a0ac40d8dca334"))
        assertFalse(Evm.isAddress("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"))
        assertFalse(Evm.isAddress("bob.near"))
    }
}
