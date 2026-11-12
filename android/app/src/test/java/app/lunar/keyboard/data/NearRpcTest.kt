package app.lunar.keyboard.data

import app.lunar.keyboard.core.NearName
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigDecimal

/** Parses responses recorded from rpc.mainnet.near.org (test/resources). */
class NearRpcTest {
    private fun res(name: String) = javaClass.classLoader!!.getResource(name)!!.readText()

    @Test fun an_existing_account_is_found_with_its_balance() {
        val a = NearRpc.parseViewAccount(NearName.Network.MAINNET, res("view_account_found.json"))
        assertTrue(a is NearRpc.Account.Found)
        assertTrue((a as NearRpc.Account.Found).balanceNear > BigDecimal.ZERO)
    }

    @Test fun an_unknown_account_is_missing() {
        val a = NearRpc.parseViewAccount(NearName.Network.MAINNET, res("view_account_missing.json"))
        assertEquals(NearRpc.Account.Missing(NearName.Network.MAINNET), a)
    }

    @Test fun any_other_error_is_a_failure_not_a_missing_account() {
        val a = NearRpc.parseViewAccount(NearName.Network.MAINNET,
            """{"jsonrpc":"2.0","error":{"name":"HANDLER_ERROR","cause":{"name":"TIMEOUT_ERROR"},"message":"Server error"},"id":"x"}""")
        assertTrue(a is NearRpc.Account.Failed)
    }
}
